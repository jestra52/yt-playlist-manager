import { getDatabase } from '@ytpm/core/db/index';
import { secretToWords, wordsToSecret } from '@ytpm/core/sync/chain-code';
import { recoveryCodeProblem } from '@ytpm/core/sync/recovery-code';
import * as client from '@ytpm/core/sync/sync.client';
import * as repo from '@ytpm/core/sync/sync.repository';
import type { AppThunk } from '../../app/store';
import { notify } from '../ui/ui.slice';
import { selectConfigured, selectSyncSettings } from './sync.selectors';
import { chainJoined, eventsLoaded, newCodeSet, type NewCode } from './sync.slice';
import { checkedCodes, forgotten, leftChain, loadChain, syncNow, withBusy } from './sync.thunks';

/** Saves this device's place in a chain, shows its code once when there's a reason to, and syncs. */
export const joined =
    (
        access: client.ChainAccess,
        { reason, claimed = false }: { reason?: NewCode['reason']; claimed?: boolean } = {},
    ): AppThunk =>
    (dispatch) => {
        const db = getDatabase();
        const settings = repo.setChainAccess(db, access, { claimed });
        const newCode =
            reason && access.secret
                ? { words: secretToWords(access.secret), recoveryCodes: access.recoveryCodes ?? [], reason }
                : null;
        dispatch(
            chainJoined({
                settings,
                pending: repo.countPending(db),
                codeCheckedAt: repo.getCodeCheckedAt(db),
                newCode,
            }),
        );
        dispatch(syncNow({ quiet: true }));
        dispatch(loadChain());
    };

/** Creates a sync chain with this device in it, then shows its code once and syncs. */
export const createChain =
    (deviceName: string): AppThunk<Promise<boolean>> =>
    (dispatch, getState) =>
        dispatch(
            withBusy(async () => {
                const access = await client.createChain(selectSyncSettings(getState()), deviceName);
                dispatch(joined(access, { reason: 'created' }));
                return true;
            }),
        );

/** Joins the chain whose 24-word code was typed or pasted; mistyped codes never leave this device. */
export const joinChain =
    (codeText: string, deviceName: string): AppThunk<Promise<boolean>> =>
    (dispatch, getState) =>
        dispatch(
            withBusy(async () => {
                const secret = wordsToSecret(codeText);
                const access = await client.joinChain(selectSyncSettings(getState()), secret, deviceName);
                dispatch(joined(access));
                dispatch(notify('Joined the sync chain. Your playlists are syncing.'));
                return true;
            }),
        );

/** Turns the library synced with the old sync token into a chain, once, then shows its code. */
export const claimLegacyChain =
    (deviceName: string): AppThunk<Promise<boolean>> =>
    (dispatch, getState) =>
        dispatch(
            withBusy(async () => {
                const settings = selectSyncSettings(getState());
                const access = await client.claimLegacyChain(settings, settings.legacyToken, deviceName);
                dispatch(joined(access, { reason: 'claimed', claimed: true }));
                return true;
            }),
        );

/**
 * Recovers a chain with one of its recovery codes, on a device that isn't in it: the
 * chain gets a new code and new recovery codes (shown once), every old device is
 * removed, and this device joins and merges its library into the chain's.
 */
export const recoverChain =
    (codeText: string, deviceName: string): AppThunk<Promise<boolean>> =>
    (dispatch, getState) =>
        dispatch(
            withBusy(async () => {
                const problem = recoveryCodeProblem(codeText, { complete: true });
                if (problem) throw new Error(problem);
                const access = await client.recoverChain(selectSyncSettings(getState()), codeText, deviceName);
                dispatch(joined(access, { reason: 'recovered' }));
                return true;
            }),
        );

/** Removes another device from the chain. */
export const removeDevice =
    (deviceId: string): AppThunk<Promise<boolean>> =>
    (dispatch, getState) =>
        dispatch(
            withBusy(async () => {
                await client.removeDevice(selectSyncSettings(getState()), deviceId);
                await dispatch(loadChain());
                dispatch(notify('Removed the device from the sync chain'));
                return true;
            }),
        );

/** A new code and new recovery codes for the chain: the old ones stop working and every other device is removed. */
export const replaceCode = (): AppThunk<Promise<boolean>> => (dispatch, getState) =>
    dispatch(
        withBusy(async () => {
            const { secret, recoveryCodes } = await client.replaceChainCode(selectSyncSettings(getState()));
            dispatch(newCodeSet({ words: secretToWords(secret), recoveryCodes, reason: 'replaced' }));
            await dispatch(loadChain());
            return true;
        }),
    );

/** New recovery codes for the chain, shown once; the old ones stop working. */
export const renewRecoveryCodes = (): AppThunk<Promise<boolean>> => (dispatch, getState) =>
    dispatch(
        withBusy(async () => {
            const { codes } = await client.renewRecoveryCodes(selectSyncSettings(getState()));
            dispatch(newCodeSet({ recoveryCodes: codes, reason: 'recovery-codes' }));
            await dispatch(loadChain());
            return true;
        }),
    );

/** Loads the chain's audit log. */
export const loadEvents = (): AppThunk<Promise<client.ChainEvent[] | null>> => async (dispatch, getState) => {
    if (!selectConfigured(getState())) {
        dispatch(eventsLoaded(null));
        return null;
    }
    try {
        const events = await client.getChainEvents(selectSyncSettings(getState()));
        dispatch(eventsLoaded(events));
        return events;
    } catch (err) {
        if (!dispatch(forgotten(err))) dispatch(notify((err as Error).message, { tone: 'error', timeout: 6000 }));
        return null;
    }
};

/** Takes this device out of the chain; its playlists stay here. */
export const leaveChain = (): AppThunk<Promise<boolean>> => (dispatch, getState) =>
    dispatch(
        withBusy(async () => {
            const settings = selectSyncSettings(getState());
            await client.removeDevice(settings, settings.deviceId);
            dispatch(leftChain('This device left the sync chain. Your playlists stay here.'));
            return true;
        }),
    );

/** Deletes the chain with all its devices and its copy of the data; playlists on this device stay. */
export const deleteChain = (): AppThunk<Promise<boolean>> => (dispatch, getState) =>
    dispatch(
        withBusy(async () => {
            await client.deleteChain(selectSyncSettings(getState()));
            dispatch(
                leftChain('Deleted the sync chain and its data from the server. Your playlists stay on this device.'),
            );
            return true;
        }),
    );

/** Called once the person has saved the codes that were shown. */
export const codeSaved = (): AppThunk => (dispatch, getState) => {
    if (getState().sync.newCode && selectConfigured(getState())) dispatch(checkedCodes());
    dispatch(newCodeSet(null));
    dispatch(loadEvents());
};
