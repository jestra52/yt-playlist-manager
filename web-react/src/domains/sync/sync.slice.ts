import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Chain, ChainEvent, PairingStatus } from '@ytpm/core/sync/sync.client';
import type { SyncSettings } from '@ytpm/core/sync/sync.repository';

export interface NewCode {
    words?: string[];
    recoveryCodes?: string[];
    reason: 'created' | 'claimed' | 'recovered' | 'replaced' | 'recovery-codes';
}

export interface ShownPairing {
    code: string;
    expiresAt: number;
    status: PairingStatus;
    requesterName: string;
}

export interface JoinRequest {
    status: 'requested' | 'denied' | 'expired';
    expiresAt: number;
}

export interface SyncState {
    settings: SyncSettings;
    status: 'idle' | 'syncing' | 'error';
    error: string | null;
    offline: boolean;
    pending: number;
    lastSyncedAt: number | null;
    chain: Chain | null;
    chainLoadedAt: number;
    warnedPauseUntil: number | null;
    /** Shown once and only kept in memory. */
    newCode: NewCode | null;
    events: ChainEvent[] | null;
    codeCheckedAt: number | null;
    busy: boolean;
    pairing: ShownPairing | null;
    joinRequest: JoinRequest | null;
}

const initialState: SyncState = {
    settings: { apiUrl: '/api', credential: '', chainId: '', deviceId: '', legacyToken: '', autoSync: true },
    status: 'idle',
    error: null,
    offline: false,
    pending: 0,
    lastSyncedAt: null,
    chain: null,
    chainLoadedAt: 0,
    warnedPauseUntil: null,
    newCode: null,
    events: null,
    codeCheckedAt: null,
    busy: false,
    pairing: null,
    joinRequest: null,
};

export const syncSlice = createSlice({
    name: 'sync',
    initialState,
    reducers: {
        loaded: (
            state,
            { payload }: PayloadAction<Pick<SyncState, 'settings' | 'lastSyncedAt' | 'pending' | 'codeCheckedAt'>>,
        ) => {
            Object.assign(state, payload);
        },
        settingsSaved: (state, { payload }: PayloadAction<Pick<SyncState, 'settings' | 'pending'>>) => {
            Object.assign(state, payload);
            state.error = null;
            if (state.status === 'error') state.status = 'idle';
        },
        pendingCounted: (state, { payload }: PayloadAction<number>) => {
            state.pending = payload;
        },
        chainJoined: (
            state,
            { payload }: PayloadAction<Pick<SyncState, 'settings' | 'pending' | 'codeCheckedAt' | 'newCode'>>,
        ) => {
            state.settings = payload.settings;
            state.pending = payload.pending;
            state.codeCheckedAt = payload.codeCheckedAt;
            state.newCode = payload.newCode ?? state.newCode;
            state.error = null;
            state.status = 'idle';
        },
        chainLeft: (state, { payload }: PayloadAction<SyncSettings>) => {
            state.settings = payload;
            state.chain = null;
            state.pairing = null;
            state.newCode = null;
            state.events = null;
            state.codeCheckedAt = null;
        },
        chainLoaded: (state, { payload }: PayloadAction<{ chain: Chain | null; at: number }>) => {
            state.chain = payload.chain;
            state.chainLoadedAt = payload.at;
        },
        pauseWarned: (state, { payload }: PayloadAction<number>) => {
            state.warnedPauseUntil = payload;
        },
        eventsLoaded: (state, { payload }: PayloadAction<ChainEvent[] | null>) => {
            state.events = payload;
        },
        newCodeSet: (state, { payload }: PayloadAction<NewCode | null>) => {
            state.newCode = payload;
        },
        codeChecked: (state, { payload }: PayloadAction<number>) => {
            state.codeCheckedAt = payload;
        },
        busySet: (state, { payload }: PayloadAction<boolean>) => {
            state.busy = payload;
        },
        pairingSet: (state, { payload }: PayloadAction<ShownPairing | null>) => {
            state.pairing = payload;
        },
        pairingUpdated: (state, { payload }: PayloadAction<Partial<ShownPairing>>) => {
            if (state.pairing) Object.assign(state.pairing, payload);
        },
        joinRequestSet: (state, { payload }: PayloadAction<JoinRequest | null>) => {
            state.joinRequest = payload;
        },
        syncStarted: (state) => {
            state.status = 'syncing';
            state.error = null;
        },
        syncFinished: (state, { payload }: PayloadAction<{ lastSyncedAt: number; pending: number }>) => {
            state.status = 'idle';
            state.offline = false;
            state.lastSyncedAt = payload.lastSyncedAt;
            state.pending = payload.pending;
        },
        syncFailed: (state, { payload }: PayloadAction<{ error: string; offline: boolean }>) => {
            state.status = 'error';
            state.error = payload.error;
            state.offline = payload.offline;
        },
        syncStopped: (state) => {
            state.status = 'idle';
        },
        /** Asks for a quiet sync after this many milliseconds, replacing any sync already waiting. */
        syncRequested: (_, __: PayloadAction<number>) => {},
    },
});

export const {
    loaded,
    settingsSaved,
    pendingCounted,
    chainJoined,
    chainLeft,
    chainLoaded,
    pauseWarned,
    eventsLoaded,
    newCodeSet,
    codeChecked,
    busySet,
    pairingSet,
    pairingUpdated,
    joinRequestSet,
    syncStarted,
    syncFinished,
    syncFailed,
    syncStopped,
    syncRequested,
} = syncSlice.actions;
