import { getDatabase } from '../../core/db/index.js';
import { setApiBase } from '../../core/config.js';
import { onDataChanged } from '../../core/events.js';
import { notify } from '../ui/ui.service.svelte.js';
import { playlists } from '../playlists/playlists.service.svelte.js';
import { videos } from '../videos/videos.service.svelte.js';
import * as client from './sync.client.js';
import { secretToWords, wordsToSecret } from './chain-code.js';
import * as repo from './sync.repository.js';

const PUSH_DELAY_MS = 2500;
const POLL_INTERVAL_MS = 60_000;

/**
 * Application layer for sync: settings, this device's sync chain, status for
 * the UI, the two-way sync use case and the background scheduling around it.
 */
class SyncService {
    settings = $state({ apiUrl: '/api', credential: '', chainId: '', deviceId: '', legacyToken: '', autoSync: true });
    status = $state('idle'); // 'idle' | 'syncing' | 'error'
    error = $state(null);
    offline = $state(false);
    pending = $state(0);
    lastSyncedAt = $state(null);
    /** This device's chain and its devices, once loaded: { chainId, deviceId, devices }. */
    chain = $state(null);
    /**
     * A chain code to show once, after creating, claiming or replacing a chain:
     * { words, reason: 'created' | 'claimed' | 'replaced' }. Only kept in memory.
     */
    newCode = $state(null);
    busy = $state(false);

    configured = $derived(Boolean(this.settings.credential));

    #inFlight = null;
    #timer = null;

    load() {
        const db = getDatabase();
        this.settings = repo.getSettings(db);
        this.lastSyncedAt = repo.getLastSyncedAt(db);
        this.pending = repo.countPending(db);
        setApiBase(this.settings.apiUrl);
    }

    saveSettings(settings) {
        const db = getDatabase();
        this.settings = repo.saveSettings(db, settings);
        this.pending = repo.countPending(db);
        this.error = null;
        if (this.status === 'error') this.status = 'idle';
        setApiBase(this.settings.apiUrl);
    }

    refreshPending() {
        this.pending = repo.countPending(getDatabase());
    }

    /** Checks that the API is reachable and configured, without syncing. */
    async testConnection(settings) {
        try {
            const health = await client.getHealth(settings);
            if (!health.syncConfigured) {
                return {
                    ok: false,
                    message: 'The API is up, but the server has no database or SYNC_PEPPER set yet.',
                };
            }
            return { ok: true, message: 'Connected. The sync server is ready.' };
        } catch (err) {
            return { ok: false, message: err.message };
        }
    }

    // ---- sync chain ----------------------------------------------------

    /** Creates a sync chain with this device in it, then shows its code once and syncs. */
    async createChain(deviceName) {
        return this.#withBusy(async () => {
            const access = await client.createChain(this.#snapshot(), deviceName);
            this.#joined(access, { reason: 'created' });
            return true;
        });
    }

    /**
     * Joins the chain whose 24-word code was typed or pasted. Mistyped codes are
     * caught here (the words carry a checksum) before anything is sent.
     */
    async joinChain(codeText, deviceName) {
        return this.#withBusy(async () => {
            const secret = wordsToSecret(codeText);
            const access = await client.joinChain(this.#snapshot(), secret, deviceName);
            this.#joined(access);
            notify('Joined the sync chain. Your playlists are syncing.');
            return true;
        });
    }

    /** Turns the library synced with the old sync token into a chain, once, then shows its code. */
    async claimLegacyChain(deviceName) {
        return this.#withBusy(async () => {
            const settings = this.#snapshot();
            const access = await client.claimLegacyChain(settings, settings.legacyToken, deviceName);
            this.#joined(access, { reason: 'claimed', claimed: true });
            return true;
        });
    }

    /** Loads this device's chain and its devices into `chain`. */
    async loadChain() {
        if (!this.configured) {
            this.chain = null;
            return null;
        }
        try {
            this.chain = await client.getChain(this.#snapshot());
            return this.chain;
        } catch (err) {
            this.#failed(err);
            return null;
        }
    }

    /** Removes another device from the chain. */
    async removeDevice(deviceId) {
        return this.#withBusy(async () => {
            await client.removeDevice(this.#snapshot(), deviceId);
            await this.loadChain();
            notify('Removed the device from the sync chain');
            return true;
        });
    }

    /** A new code for the chain: the old one stops working and every other device is removed. */
    async replaceCode() {
        return this.#withBusy(async () => {
            const { secret } = await client.replaceChainCode(this.#snapshot());
            this.newCode = { words: secretToWords(secret), reason: 'replaced' };
            await this.loadChain();
            return true;
        });
    }

    /** Takes this device out of the chain; its playlists stay here. */
    async leaveChain() {
        return this.#withBusy(async () => {
            const settings = this.#snapshot();
            await client.removeDevice(settings, settings.deviceId);
            this.#left('This device left the sync chain. Your playlists stay here.');
            return true;
        });
    }

    /** Deletes the chain with all its devices and its copy of the data; playlists on this device stay. */
    async deleteChain() {
        return this.#withBusy(async () => {
            await client.deleteChain(this.#snapshot());
            this.#left('Deleted the sync chain and its data from the server. Your playlists stay on this device.');
            return true;
        });
    }

    /** Called once the person has saved the code shown in `newCode`. */
    codeSaved() {
        this.newCode = null;
    }

    #snapshot() {
        return $state.snapshot(this.settings);
    }

    #joined(access, { reason = null, claimed = false } = {}) {
        const db = getDatabase();
        this.settings = repo.setChainAccess(db, access, { claimed });
        this.pending = repo.countPending(db);
        if (reason && access.secret) this.newCode = { words: secretToWords(access.secret), reason };
        this.error = null;
        this.status = 'idle';
        this.syncNow({ quiet: true });
        this.loadChain();
    }

    #left(message) {
        this.settings = repo.clearChainAccess(getDatabase());
        this.chain = null;
        this.newCode = null;
        notify(message, { timeout: 6000 });
    }

    /**
     * When the server no longer knows this device (removed from another device,
     * or the chain was replaced or deleted), forget the chain; local data stays.
     */
    #failed(err) {
        if (err?.status === 401 && this.configured) {
            this.#left('This device is no longer in the sync chain. Join again with the chain code to keep syncing.');
            return true;
        }
        return false;
    }

    async #withBusy(work) {
        this.busy = true;
        try {
            return await work();
        } catch (err) {
            if (!this.#failed(err)) notify(err.message, { tone: 'error', timeout: 6000 });
            return false;
        } finally {
            this.busy = false;
        }
    }

    // ---- two-way sync --------------------------------------------------

    /**
     * Two-way sync: pushes rows marked dirty, pulls everything newer than the
     * saved cursor and applies it with last-write-wins. Overlapping calls
     * share the same run.
     */
    syncNow({ quiet = false } = {}) {
        this.#inFlight ??= this.#run(quiet).finally(() => {
            this.#inFlight = null;
        });
        return this.#inFlight;
    }

    async #run(quiet) {
        if (!this.configured) {
            if (!quiet) notify('Create or join a sync chain in sync settings first', { tone: 'error' });
            return false;
        }
        const db = getDatabase();
        const settings = $state.snapshot(this.settings);
        this.status = 'syncing';
        this.error = null;
        let pulled = 0;
        try {
            let since = repo.getCursor(db);
            for (let round = 0; round < 50; round++) {
                const changes = repo.collectChanges(db);
                const response = await client.postSync(settings, { since, changes });
                db.transaction(() => {
                    repo.markPushed(db, changes);
                    pulled += repo.applyRemote(db, response.changes ?? {});
                    repo.setCursor(db, response.cursor);
                });
                since = response.cursor;
                // Keep going while the server has more pages or local edits remain.
                if (!response.hasMore && repo.countPending(db) === 0) break;
            }
            this.lastSyncedAt = Date.now();
            repo.setLastSyncedAt(db, this.lastSyncedAt);
            await db.flush?.();
            if (pulled > 0) {
                playlists.load();
                videos.load();
            }
            this.status = 'idle';
            this.offline = false;
            this.pending = repo.countPending(db);
            if (!quiet)
                notify(
                    pulled > 0
                        ? `Synced. ${pulled} change${pulled === 1 ? '' : 's'} from the cloud.`
                        : 'Everything is in sync',
                );
            return true;
        } catch (err) {
            if (this.#failed(err)) {
                this.status = 'idle';
                return false;
            }
            this.status = 'error';
            this.error = err.message;
            this.offline = Boolean(err.offline);
            if (!quiet) notify(err.message, { tone: 'error' });
            return false;
        }
    }

    /**
     * Syncs quietly after local edits, every minute while the tab is visible,
     * and when the network comes back. Returns a function that stops it.
     */
    startAutoSync() {
        const enabled = () => this.configured && this.settings.autoSync;
        const schedule = (delay = PUSH_DELAY_MS) => {
            clearTimeout(this.#timer);
            this.#timer = setTimeout(() => {
                if (enabled() && navigator.onLine !== false) this.syncNow({ quiet: true });
            }, delay);
        };

        const stopListening = onDataChanged(() => {
            this.refreshPending();
            schedule();
        });
        const onOnline = () => schedule(500);
        const onVisible = () => document.visibilityState === 'visible' && schedule(500);
        addEventListener('online', onOnline);
        document.addEventListener('visibilitychange', onVisible);
        const poll = setInterval(() => document.visibilityState === 'visible' && schedule(0), POLL_INTERVAL_MS);
        schedule(300);

        return () => {
            clearTimeout(this.#timer);
            clearInterval(poll);
            stopListening();
            removeEventListener('online', onOnline);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }
}

export const sync = new SyncService();
