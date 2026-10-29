import { getDatabase } from '../../core/db/index.js';
import { setApiBase } from '../../core/config.js';
import { onDataChanged } from '../../core/events.js';
import { notify } from '../ui/ui.service.svelte.js';
import { playlists } from '../playlists/playlists.service.svelte.js';
import { videos } from '../videos/videos.service.svelte.js';
import { postSync, getHealth } from './sync.client.js';
import * as repo from './sync.repository.js';

const PUSH_DELAY_MS = 2500;
const POLL_INTERVAL_MS = 60_000;

/**
 * Application layer for sync: settings, status for the UI, the two-way
 * sync use case and the background scheduling around it.
 */
class SyncService {
    settings = $state({ apiUrl: '/api', token: '', autoSync: true });
    status = $state('idle'); // 'idle' | 'syncing' | 'error'
    error = $state(null);
    offline = $state(false);
    pending = $state(0);
    lastSyncedAt = $state(null);

    configured = $derived(Boolean(this.settings.token));

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
            const health = await getHealth(settings);
            if (!health.syncConfigured) {
                return { ok: false, message: 'The API is up, but the server has no database or SYNC_TOKEN set yet.' };
            }
            return { ok: true, message: 'Connected. The sync server is ready.' };
        } catch (err) {
            return { ok: false, message: err.message };
        }
    }

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
            if (!quiet) notify('Add your sync token in sync settings first', { tone: 'error' });
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
                const response = await postSync(settings, { since, changes });
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
