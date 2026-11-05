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
const POLL_INTERVAL_MS = 60_000;

// Only edits made here count: a sync's own writes must not schedule another sync.
const isLocalEdit = isAnyOf(added, playlistChanged, playlistRemoved, upserted, videoChanged, videoRemoved, replaced);

/** Waits for a quiet moment after each edit or request, then syncs once. */
export const autoSyncMiddleware = (): Middleware => {
    const listener = createListenerMiddleware();
    listener.startListening({
        predicate: (action) => isLocalEdit(action) || syncRequested.match(action),
        effect: async (action, api) => {
            const dispatch = api.dispatch as AppDispatch;
            if (isLocalEdit(action)) dispatch(refreshPending());
            api.cancelActiveListeners();
            await api.delay(syncRequested.match(action) ? action.payload : PUSH_DELAY_MS);
            const state = api.getState() as RootState;
            if (selectConfigured(state) && selectSyncSettings(state).autoSync && navigator.onLine !== false) {
                dispatch(syncNow({ quiet: true }));
            }
        },
    });
    return listener.middleware;
};

/** Syncs every minute while the tab is visible, and when the tab or the network comes back. Returns a stop function. */
export const startAutoSync = (): AppThunk<() => void> => (dispatch) => {
    const visible = () => document.visibilityState === 'visible';
    const onOnline = () => dispatch(syncRequested(500));
    const onVisible = () => {
        if (visible()) dispatch(syncRequested(500));
    };
    addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const poll = setInterval(() => {
        if (visible()) dispatch(syncRequested(0));
    }, POLL_INTERVAL_MS);
    dispatch(syncRequested(300));

    return () => {
        clearInterval(poll);
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
