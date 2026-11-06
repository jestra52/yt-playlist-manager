import { getDatabase } from '@ytpm/core/db/index';
import { pairingPausedUntil } from '@ytpm/core/sync/chain-reminders';
import * as client from '@ytpm/core/sync/sync.client';
import * as repo from '@ytpm/core/sync/sync.repository';
import type { AppThunk } from '../../app/store';
import { reloadLibrary } from '../playlists/playlists.thunks';
import { notify } from '../ui/ui.slice';
import { selectConfigured, selectSyncSettings } from './sync.selectors';
import {
    busySet,
    chainLeft,
    chainLoaded,
    codeChecked,
    loaded,
    pauseWarned,
    pendingCounted,
    settingsSaved,
    syncFailed,
    syncFinished,
    syncStarted,
    syncStopped,
} from './sync.slice';

/** After a sync, the chain (its devices, and whether pairing is paused) is reloaded at most this often. */
const CHAIN_REFRESH_MS = 10 * 60_000;

let inFlight: Promise<boolean> | null = null;
let pairingWatch: AbortController | null = null;

export const followingPairing = (watch: AbortController | null): void => {
    pairingWatch?.abort();
    pairingWatch = watch;
};

export const checkedCodes = (): AppThunk => (dispatch) => {
    const at = Date.now();
    repo.setCodeCheckedAt(getDatabase(), at);
    dispatch(codeChecked(at));
};

/** Reads the sync settings and bookkeeping from the local database into the store. */
export const loadSync = (): AppThunk => (dispatch, getState) => {
    const db = getDatabase();
    // The address can't be changed anymore. A chain on another address doesn't exist on this one.
    const { apiUrl, autoSync } = repo.getSettings(db);
    if (apiUrl !== '/api') repo.saveSettings(db, { autoSync });
    dispatch(
        loaded({
            settings: repo.getSettings(db),
            lastSyncedAt: repo.getLastSyncedAt(db),
            pending: repo.countPending(db),
            codeCheckedAt: repo.getCodeCheckedAt(db),
        }),
    );
    // Devices that joined before check-ins existed start counting now.
    if (selectConfigured(getState()) && !getState().sync.codeCheckedAt) dispatch(checkedCodes());
};

export const saveSyncSettings =
    (settings: Pick<repo.SyncSettings, 'autoSync'>): AppThunk =>
    (dispatch) => {
        const db = getDatabase();
        dispatch(settingsSaved({ settings: repo.saveSettings(db, settings), pending: repo.countPending(db) }));
    };

export const refreshPending = (): AppThunk => (dispatch) => {
    dispatch(pendingCounted(repo.countPending(getDatabase())));
};

/** Forgets this device's chain; its playlists stay here. */
export const leftChain =
    (message: string): AppThunk =>
    (dispatch) => {
        followingPairing(null);
        dispatch(chainLeft(repo.clearChainAccess(getDatabase())));
        dispatch(notify(message, { timeout: 6000 }));
    };

/**
 * When the server no longer knows this device (removed from another device, or
 * the chain was replaced or deleted), forgets the chain. True when that happened.
 */
export const forgotten =
    (err: unknown): AppThunk<boolean> =>
    (dispatch, getState) => {
        if ((err as client.SyncError)?.status !== 401 || !selectConfigured(getState())) return false;
        dispatch(
            leftChain('This device is no longer in the sync chain. Join again with the chain code to keep syncing.'),
        );
        return true;
    };

export const withBusy =
    <T>(work: () => Promise<T>): AppThunk<Promise<T | false>> =>
    async (dispatch) => {
        dispatch(busySet(true));
        try {
            return await work();
        } catch (err) {
            if (!dispatch(forgotten(err))) dispatch(notify((err as Error).message, { tone: 'error', timeout: 6000 }));
            return false;
        } finally {
            dispatch(busySet(false));
        }
    };

/** Shows a notice once per pause, on whichever device of the chain notices it first. */
const warnIfPairingPaused = (): AppThunk => (dispatch, getState) => {
    const { chain, warnedPauseUntil } = getState().sync;
    const until = pairingPausedUntil(chain);
    if (!until || until === warnedPauseUntil) return;
    dispatch(pauseWarned(until));
    const time = new Date(until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    dispatch(
        notify(
            `Someone was refused several times while trying to join your sync chain. Adding devices with a pairing code is paused until ${time}.`,
            { tone: 'error', timeout: 10000 },
        ),
    );
};

/** Loads this device's chain and its devices. */
export const loadChain = (): AppThunk<Promise<client.Chain | null>> => async (dispatch, getState) => {
    if (!selectConfigured(getState())) {
        dispatch(chainLoaded({ chain: null, at: 0 }));
        return null;
    }
    try {
        const chain = await client.getChain(selectSyncSettings(getState()));
        dispatch(chainLoaded({ chain, at: Date.now() }));
        dispatch(warnIfPairingPaused());
        return chain;
    } catch (err) {
        dispatch(forgotten(err));
        return null;
    }
};

const run =
    (quiet: boolean): AppThunk<Promise<boolean>> =>
    async (dispatch, getState) => {
        if (!selectConfigured(getState())) {
            if (!quiet) dispatch(notify('Create or join a sync chain in sync settings first', { tone: 'error' }));
            return false;
        }
        const db = getDatabase();
        const settings = selectSyncSettings(getState());
        dispatch(syncStarted());
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
            const lastSyncedAt = Date.now();
            repo.setLastSyncedAt(db, lastSyncedAt);
            await db.flush();
            if (pulled > 0) dispatch(reloadLibrary());
            dispatch(syncFinished({ lastSyncedAt, pending: repo.countPending(db) }));
            // So every device hears of a pause in pairing, not only the one showing the settings.
            if (Date.now() - getState().sync.chainLoadedAt >= CHAIN_REFRESH_MS) dispatch(loadChain());
            if (!quiet) {
                const message =
                    pulled > 0
                        ? `Synced. ${pulled} change${pulled === 1 ? '' : 's'} from the cloud.`
                        : 'Everything is in sync';
                dispatch(notify(message));
            }
            return true;
        } catch (err) {
            if (dispatch(forgotten(err))) {
                dispatch(syncStopped());
                return false;
            }
            const { message, offline, retryAfterMs: waitMs } = err as client.SyncError;
            dispatch(syncFailed({ error: message, offline: Boolean(offline), waitMs }));
            if (!quiet) dispatch(notify(message, { tone: 'error' }));
            return false;
        }
    };

/**
 * Two-way sync: pushes rows marked dirty, pulls everything newer than the saved
 * cursor and applies it with last-write-wins. Overlapping calls share the same run.
 */
export const syncNow =
    ({ quiet = false } = {}): AppThunk<Promise<boolean>> =>
    (dispatch) => {
        inFlight ??= dispatch(run(quiet)).finally(() => {
            inFlight = null;
        });
        return inFlight;
    };
