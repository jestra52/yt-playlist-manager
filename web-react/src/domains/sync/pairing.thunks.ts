import { waitForApproval, watchPairing } from '@ytpm/core/sync/pairing';
import { formatPairingCode, isPairingCode, pairingCodeProblem } from '@ytpm/core/sync/pairing-code';
import * as client from '@ytpm/core/sync/sync.client';
import type { AppThunk } from '../../app/store';
import { notify } from '../ui/ui.slice';
import { joined, loadEvents } from './chain.thunks';
import { selectConfigured, selectSyncSettings } from './sync.selectors';
import { busySet, joinRequestSet, pairingSet, pairingUpdated } from './sync.slice';
import { followingPairing, forgotten, loadChain, withBusy } from './sync.thunks';

let joinWait: AbortController | null = null;

const followPairing = (): AppThunk => (dispatch, getState) => {
    const watch = new AbortController();
    followingPairing(watch);
    watchPairing(selectSyncSettings(getState()), {
        signal: watch.signal,
        onChange: ({ status, requesterName, expiresAt }) => {
            const shown = getState().sync.pairing;
            if (!shown || watch.signal.aborted) return;
            // Once a device enters the code, the time left is the shorter one to approve it.
            const name = requesterName || shown.requesterName;
            dispatch(pairingUpdated({ status, requesterName: name, expiresAt: expiresAt ?? shown.expiresAt }));
            if (status === 'joined') {
                dispatch(notify(`${name || 'The new device'} joined the sync chain`));
                dispatch(loadChain());
                dispatch(loadEvents());
            } else if (status === 'expired') {
                // A pause after refused attempts cancels the code too.
                dispatch(loadChain());
            }
        },
    }).catch((err: unknown) => {
        if (watch.signal.aborted || dispatch(forgotten(err))) return;
        dispatch(notify((err as Error).message, { tone: 'error', timeout: 6000 }));
    });
};

/** Shows a new pairing code for another device to enter, and follows it until that device asks to join. */
export const startPairing = (): AppThunk<Promise<boolean>> => (dispatch, getState) =>
    dispatch(
        withBusy(async () => {
            const { code, expiresAt } = await client.startPairing(selectSyncSettings(getState()));
            dispatch(pairingSet({ code, expiresAt, status: 'waiting', requesterName: '' }));
            dispatch(followPairing());
            return true;
        }),
    );

/** Lets the device that entered this device's pairing code join. */
export const approvePairing = (): AppThunk<Promise<boolean>> => (dispatch, getState) =>
    dispatch(
        withBusy(async () => {
            await client.approvePairing(selectSyncSettings(getState()));
            dispatch(pairingUpdated({ status: 'approved' }));
            return true;
        }),
    );

/** Refuses the device that entered this device's pairing code; after a few, pairing is paused. */
export const denyPairing = (): AppThunk<Promise<boolean>> => (dispatch, getState) =>
    dispatch(
        withBusy(async () => {
            await client.denyPairing(selectSyncSettings(getState()));
            followingPairing(null);
            dispatch(pairingUpdated({ status: 'denied' }));
            await dispatch(loadChain());
            dispatch(loadEvents());
            return true;
        }),
    );

/** Stops showing this device's pairing code; it stops working. */
export const cancelPairing = (): AppThunk => (dispatch, getState) => {
    followingPairing(null);
    const { pairing } = getState().sync;
    const open = pairing && !['joined', 'denied', 'expired'].includes(pairing.status);
    dispatch(pairingSet(null));
    if (open && selectConfigured(getState())) client.cancelPairing(selectSyncSettings(getState())).catch(() => {});
};

/**
 * Joins a chain with a pairing code shown on one of its devices: waits until that
 * device approves, then gets its own credential and syncs. Resolves to true once
 * joined; false when refused, expired or cancelled.
 */
export const joinWithPairingCode =
    (codeText: string, deviceName: string): AppThunk<Promise<boolean>> =>
    async (dispatch, getState) => {
        if (!isPairingCode(codeText)) {
            dispatch(notify(pairingCodeProblem(codeText) || 'A pairing code has 8 characters.', { tone: 'error' }));
            return false;
        }
        const wait = new AbortController();
        joinWait?.abort();
        joinWait = wait;
        dispatch(busySet(true));
        try {
            const settings = selectSyncSettings(getState());
            const ticket = await client.requestPairing(settings, formatPairingCode(codeText), deviceName);
            if (wait.signal.aborted) return false;
            dispatch(joinRequestSet({ status: 'requested', expiresAt: ticket.expiresAt }));
            const result = await waitForApproval(settings, ticket.requestToken, { signal: wait.signal });
            if (!result) return false;
            if (result.status !== 'approved') {
                dispatch(joinRequestSet({ status: result.status, expiresAt: ticket.expiresAt }));
                return false;
            }
            dispatch(joinRequestSet(null));
            dispatch(joined(result));
            dispatch(notify('Joined the sync chain. Your playlists are syncing.'));
            return true;
        } catch (err) {
            if (!wait.signal.aborted) {
                dispatch(joinRequestSet(null));
                dispatch(notify((err as Error).message, { tone: 'error', timeout: 6000 }));
            }
            return false;
        } finally {
            if (joinWait === wait) {
                joinWait = null;
                dispatch(busySet(false));
            }
        }
    };

/** Stops waiting for approval of this device's pairing request. */
export const cancelJoinRequest = (): AppThunk => (dispatch) => {
    joinWait?.abort();
    joinWait = null;
    dispatch(joinRequestSet(null));
    dispatch(busySet(false));
};
