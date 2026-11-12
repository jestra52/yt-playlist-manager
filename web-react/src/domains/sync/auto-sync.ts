import { createListenerMiddleware, isAnyOf, type Middleware } from '@reduxjs/toolkit';
import type { Database } from '@ytpm/core/db/database';
import type { AppDispatch, AppThunk, RootState } from '../../app/store';
import { added, changed as playlistChanged, removed as playlistRemoved } from '../playlists/playlists.slice';
import { reloadLibrary } from '../playlists/playlists.thunks';
import { changed as videoChanged, removed as videoRemoved, replaced, upserted } from '../videos/videos.slice';
import { selectConfigured, selectSyncSettings } from './sync.selectors';
import { syncRequested } from './sync.slice';
import { loadSync, refreshPending, syncNow } from './sync.thunks';

const PUSH_DELAY_MS = 2500;
const RETURN_QUIET_MS = 30_000;
const RETRY_FIRST_MS = 5000;
const RETRY_MAX_MS = 5 * 60_000;

// Doubles with each failure, with some randomness so devices don't all retry together.
const retryWait = (failures: number) =>
    Math.min(RETRY_FIRST_MS * 2 ** (failures - 1), RETRY_MAX_MS) * (0.75 + Math.random() / 2);

// Only edits made here count: a sync's own writes must not schedule another sync.
const isLocalEdit = isAnyOf(added, playlistChanged, playlistRemoved, upserted, videoChanged, videoRemoved, replaced);

/** Waits for a quiet moment after each edit or request, then syncs once, retrying later if that fails. */
export const autoSyncMiddleware = (): Middleware => {
    const listener = createListenerMiddleware();
    let failures = 0;
    let notBefore = 0;
    listener.startListening({
        predicate: (action) => isLocalEdit(action) || syncRequested.match(action),
        effect: async (action, api) => {
            const dispatch = api.dispatch as AppDispatch;
            if (isLocalEdit(action)) dispatch(refreshPending());
            api.cancelActiveListeners();
            const wanted = syncRequested.match(action) ? action.payload : PUSH_DELAY_MS;
            await api.delay(Math.max(wanted, notBefore - Date.now()));
            const state = api.getState() as RootState;
            if (!selectConfigured(state) || !selectSyncSettings(state).autoSync || navigator.onLine === false) return;
            if (state.sync.outdated) return;

            if (await dispatch(syncNow({ quiet: true }))) {
                failures = 0;
                notBefore = 0;
                return;
            }
            const after = api.getState() as RootState;
            if (!selectConfigured(after) || after.sync.offline || after.sync.outdated) return;
            failures += 1;
            notBefore = Date.now() + Math.max(retryWait(failures), after.sync.waitMs);
            dispatch(syncRequested(0));
        },
    });
    return listener.middleware;
};

/** Syncs on opening, and when the tab or the network comes back. Returns a stop function. */
export const startAutoSync = (): AppThunk<() => void> => (dispatch, getState) => {
    const onOnline = () => {
        if (document.visibilityState === 'visible') dispatch(syncRequested(500));
    };
    const onVisible = () => {
        const { lastSyncedAt } = getState().sync;
        const recent = lastSyncedAt !== null && Date.now() - lastSyncedAt < RETURN_QUIET_MS;
        if (document.visibilityState === 'visible' && !recent) dispatch(syncRequested(500));
    };
    addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    dispatch(syncRequested(300));

    return () => {
        removeEventListener('online', onOnline);
        document.removeEventListener('visibilitychange', onVisible);
    };
};

/** When another tab saves the database, loads its copy so this tab doesn't overwrite it with stale data. */
export const followOtherTabs =
    (db: Database): AppThunk =>
    (dispatch) => {
        if (!('BroadcastChannel' in globalThis)) return;
        const channel = new BroadcastChannel('ytpm-db');
        db.onSaved(() => channel.postMessage('saved'));
        channel.onmessage = async () => {
            await db.reload?.();
            dispatch(loadSync());
            dispatch(reloadLibrary());
        };
    };
