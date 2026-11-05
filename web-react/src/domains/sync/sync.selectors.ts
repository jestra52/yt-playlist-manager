import { isCheckInDue, needsRecoveryNotice, pairingPausedUntil } from '@ytpm/core/sync/chain-reminders';
import type { RootState } from '../../app/store';

export const selectSync = (state: RootState) => state.sync;
export const selectSyncSettings = (state: RootState) => state.sync.settings;
export const selectApiUrl = (state: RootState) => state.sync.settings.apiUrl;
export const selectConfigured = (state: RootState) => Boolean(state.sync.settings.credential);

/** Until when adding devices with a pairing code is paused for this chain, or null. */
export const selectPairingPaused = (state: RootState) =>
    selectConfigured(state) ? pairingPausedUntil(state.sync.chain) : null;

/** Losing this device would lose the chain: it's the only one, and there are no recovery codes. */
export const selectRecoveryNotice = (state: RootState) =>
    selectConfigured(state) && needsRecoveryNotice(state.sync.chain);

/** Time to ask "Do you still have your sync chain code?" again. */
export const selectCheckInDue = (state: RootState) => selectConfigured(state) && isCheckInDue(state.sync.codeCheckedAt);
