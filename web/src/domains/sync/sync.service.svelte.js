import { getDatabase } from '@ytpm/core/db/index';
import { setApiBase } from '../../core/config.js';
import { onDataChanged } from '../../core/events.js';
import { notify } from '../ui/ui.service.svelte.js';
import { playlists } from '../playlists/playlists.service.svelte.js';
import { videos } from '../videos/videos.service.svelte.js';
import * as client from './sync.client.js';
import { secretToWords, wordsToSecret } from './chain-code.js';
import { isCheckInDue, needsRecoveryNotice, pairingPausedUntil } from './chain-reminders.js';
import * as pairingFlow from './pairing.js';
import { formatPairingCode, isPairingCode, pairingCodeProblem } from './pairing-code.js';
import { recoveryCodeProblem } from './recovery-code.js';
import * as repo from './sync.repository.js';

const PUSH_DELAY_MS = 2500;
const POLL_INTERVAL_MS = 60_000;
/** After a sync, the chain (its devices, and whether pairing is paused) is reloaded at most this often. */
const CHAIN_REFRESH_MS = 10 * 60_000;

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
     * Codes to show once: the chain code's words and the recovery codes after creating,
     * claiming, recovering or replacing a chain, or only recovery codes after renewing them:
     * { words?, recoveryCodes?, reason: 'created' | 'claimed' | 'recovered' | 'replaced' | 'recovery-codes' }.
     * Only kept in memory.
     */
    newCode = $state(null);
    /** The chain's audit log, once loaded: [{ at, kind, deviceName, detail }], newest first. */
    events = $state(null);
    /** When the person last said they still have the codes (this device only). */
    codeCheckedAt = $state(null);
    busy = $state(false);
    /**
     * This device's pairing code while it's shown, to add another device:
     * { code, expiresAt, status, requesterName }, status 'waiting' | 'requested' |
     * 'approved' | 'joined' | 'denied' | 'expired'. Only kept in memory.
     */
    pairing = $state(null);
    /**
     * This device's request to join a chain with a pairing code, while it waits:
     * { status: 'requested' | 'denied' | 'expired', expiresAt }.
     */
    joinRequest = $state(null);

    configured = $derived(Boolean(this.settings.credential));
    /** Until when adding devices with a pairing code is paused for this chain, or null. */
    pairingPaused = $derived(this.configured ? pairingPausedUntil(this.chain) : null);
    /** Losing this device would lose the chain: it's the only one, and there are no recovery codes. */
    recoveryNotice = $derived(this.configured && needsRecoveryNotice(this.chain));
    /** Time to ask "Do you still have your sync chain code?" again. */
    checkInDue = $derived(this.configured && isCheckInDue(this.codeCheckedAt));

    #inFlight = null;
    #timer = null;
    #chainLoadedAt = 0;
    #warnedPauseUntil = null;
    #pairingWatch = null;
    #joinWait = null;

    load() {
        const db = getDatabase();
        this.settings = repo.getSettings(db);
        this.lastSyncedAt = repo.getLastSyncedAt(db);
        this.pending = repo.countPending(db);
        this.codeCheckedAt = repo.getCodeCheckedAt(db);
        // Devices that joined before check-ins existed start counting now.
        if (this.configured && !this.codeCheckedAt) this.#checkedCodes();
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

    /**
     * Recovers a chain with one of its recovery codes, on a device that isn't in it: the
     * chain gets a new code and new recovery codes (shown once), every old device is
     * removed, and this device joins and merges its library into the chain's.
     */
    async recoverChain(codeText, deviceName) {
        return this.#withBusy(async () => {
            const problem = recoveryCodeProblem(codeText, { complete: true });
            if (problem) throw new Error(problem);
            const access = await client.recoverChain(this.#snapshot(), codeText, deviceName);
            this.#joined(access, { reason: 'recovered' });
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
            this.#chainLoadedAt = Date.now();
            this.#warnIfPairingPaused();
            return this.chain;
        } catch (err) {
            this.#failed(err);
            return null;
        }
    }

    // ---- adding a device with a pairing code ---------------------------

    /**
     * Shows a new pairing code on this device for another device to enter, and
     * follows it: when that device enters it, `pairing.status` becomes 'requested'
     * and the person is asked to approve it.
     */
    async startPairing() {
        return this.#withBusy(async () => {
            const { code, expiresAt } = await client.startPairing(this.#snapshot());
            this.pairing = { code, expiresAt, status: 'waiting', requesterName: '' };
            this.#followPairing();
            return true;
        });
    }

    /** Lets the device that entered this device's pairing code join. */
    async approvePairing() {
        return this.#withBusy(async () => {
            await client.approvePairing(this.#snapshot());
            if (this.pairing) this.pairing.status = 'approved';
            return true;
        });
    }

    /** Refuses the device that entered this device's pairing code; after a few, pairing is paused. */
    async denyPairing() {
        return this.#withBusy(async () => {
            await client.denyPairing(this.#snapshot());
            this.#stopFollowingPairing();
            if (this.pairing) this.pairing.status = 'denied';
            await this.loadChain();
            this.loadEvents();
            return true;
        });
    }

    /** Stops showing this device's pairing code; it stops working. */
    cancelPairing() {
        this.#stopFollowingPairing();
        const open = this.pairing && !['joined', 'denied', 'expired'].includes(this.pairing.status);
        this.pairing = null;
        if (open && this.configured) client.cancelPairing(this.#snapshot()).catch(() => {});
    }

    #followPairing() {
        this.#stopFollowingPairing();
        const ctrl = new AbortController();
        this.#pairingWatch = ctrl;
        pairingFlow
            .watchPairing(this.#snapshot(), {
                signal: ctrl.signal,
                onChange: ({ status, requesterName, expiresAt }) => {
                    if (!this.pairing || ctrl.signal.aborted) return;
                    // Once a device enters the code, the time left is the shorter one to approve it.
                    this.pairing = {
                        ...this.pairing,
                        status,
                        requesterName: requesterName || this.pairing.requesterName,
                        expiresAt: expiresAt ?? this.pairing.expiresAt,
                    };
                    if (status === 'joined') {
                        notify(`${this.pairing.requesterName || 'The new device'} joined the sync chain`);
                        this.loadChain();
                        this.loadEvents();
                    } else if (status === 'expired') {
                        // A pause after refused attempts cancels the code too.
                        this.loadChain();
                    }
                },
            })
            .catch((err) => {
                if (!ctrl.signal.aborted && !this.#failed(err)) notify(err.message, { tone: 'error', timeout: 6000 });
            });
    }

    #stopFollowingPairing() {
        this.#pairingWatch?.abort();
        this.#pairingWatch = null;
    }

    /**
     * Joins a chain with a pairing code shown on one of its devices, from this device
     * (not in a chain): waits until that device approves, then gets its own credential
     * and syncs. Resolves to true once joined; false when refused, expired or cancelled.
     */
    async joinWithPairingCode(codeText, deviceName) {
        if (!isPairingCode(codeText)) {
            notify(pairingCodeProblem(codeText) || 'A pairing code has 8 characters.', { tone: 'error' });
            return false;
        }
        const ctrl = new AbortController();
        this.#joinWait?.abort();
        this.#joinWait = ctrl;
        this.busy = true;
        try {
            const settings = this.#snapshot();
            const ticket = await client.requestPairing(settings, formatPairingCode(codeText), deviceName);
            if (ctrl.signal.aborted) return false;
            this.joinRequest = { status: 'requested', expiresAt: ticket.expiresAt };
            const result = await pairingFlow.waitForApproval(settings, ticket.requestToken, { signal: ctrl.signal });
            if (!result) return false;
            if (result.status !== 'approved') {
                this.joinRequest = { status: result.status, expiresAt: ticket.expiresAt };
                return false;
            }
            this.joinRequest = null;
            this.#joined(result);
            notify('Joined the sync chain. Your playlists are syncing.');
            return true;
        } catch (err) {
            if (!ctrl.signal.aborted) {
                this.joinRequest = null;
                notify(err.message, { tone: 'error', timeout: 6000 });
            }
            return false;
        } finally {
            if (this.#joinWait === ctrl) {
                this.#joinWait = null;
                this.busy = false;
            }
        }
    }

    /** Stops waiting for approval of this device's pairing request. */
    cancelJoinRequest() {
        this.#joinWait?.abort();
        this.#joinWait = null;
        this.joinRequest = null;
        this.busy = false;
    }

    /** Shows a toast once per pause, on whichever device of the chain notices it first. */
    #warnIfPairingPaused() {
        const until = pairingPausedUntil(this.chain);
        if (!until || until === this.#warnedPauseUntil) return;
        this.#warnedPauseUntil = until;
        const time = new Date(until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        notify(
            `Someone was refused several times while trying to join your sync chain. Adding devices with a pairing code is paused until ${time}.`,
            { tone: 'error', timeout: 10000 },
        );
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

    /**
     * A new code and new recovery codes for the chain: the old ones stop working and
     * every other device is removed.
     */
    async replaceCode() {
        return this.#withBusy(async () => {
            const { secret, recoveryCodes } = await client.replaceChainCode(this.#snapshot());
            this.newCode = { words: secretToWords(secret), recoveryCodes, reason: 'replaced' };
            await this.loadChain();
            return true;
        });
    }

    /** New recovery codes for the chain, shown once; the old ones stop working. */
    async renewRecoveryCodes() {
        return this.#withBusy(async () => {
            const { codes } = await client.renewRecoveryCodes(this.#snapshot());
            this.newCode = { recoveryCodes: codes, reason: 'recovery-codes' };
            await this.loadChain();
            return true;
        });
    }

    /** Loads the chain's audit log into `events`. */
    async loadEvents() {
        if (!this.configured) {
            this.events = null;
            return null;
        }
        try {
            this.events = await client.getChainEvents(this.#snapshot());
            return this.events;
        } catch (err) {
            if (!this.#failed(err)) notify(err.message, { tone: 'error', timeout: 6000 });
            return null;
        }
    }

    /** The person says they still have the chain code and recovery codes: ask again in a while. */
    confirmCodeCheckIn() {
        this.#checkedCodes();
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

    /** Called once the person has saved the codes shown in `newCode`. */
    codeSaved() {
        if (this.newCode && this.configured) this.#checkedCodes();
        this.newCode = null;
        this.loadEvents();
    }

    #checkedCodes() {
        const now = Date.now();
        repo.setCodeCheckedAt(getDatabase(), now);
        this.codeCheckedAt = now;
    }

    #snapshot() {
        return $state.snapshot(this.settings);
    }

    #joined(access, { reason = null, claimed = false } = {}) {
        const db = getDatabase();
        this.settings = repo.setChainAccess(db, access, { claimed });
        this.pending = repo.countPending(db);
        this.codeCheckedAt = repo.getCodeCheckedAt(db);
        if (reason && access.secret) {
            this.newCode = { words: secretToWords(access.secret), recoveryCodes: access.recoveryCodes ?? [], reason };
        }
        this.error = null;
        this.status = 'idle';
        this.syncNow({ quiet: true });
        this.loadChain();
    }

    #left(message) {
        this.#stopFollowingPairing();
        this.settings = repo.clearChainAccess(getDatabase());
        this.chain = null;
        this.pairing = null;
        this.newCode = null;
        this.events = null;
        this.codeCheckedAt = null;
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
            // So every device hears of a pause in pairing, not only the one showing the settings.
            if (Date.now() - this.#chainLoadedAt >= CHAIN_REFRESH_MS) this.loadChain();
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
