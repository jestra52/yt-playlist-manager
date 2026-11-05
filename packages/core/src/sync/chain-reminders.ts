/**
 * When to remind people of the ways back into their sync chain, so they don't end
 * up with no device and no code: a notice when nothing is left to recover with, and
 * an occasional check-in that they still have their codes. Also when to warn that
 * pairing was paused after someone was refused repeatedly.

 */
import type { Chain } from './sync.client';

export const CHECK_IN_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * True when losing this device would lose the chain: it's the only device, and the
 * chain has no unused recovery codes (passkeys, #57, will count here too).
 */
export const needsRecoveryNotice = (chain: Partial<Chain> | null | undefined): boolean => {
    if (!chain?.devices) return false;
    return chain.devices.length <= 1 && !((chain.recoveryCodesLeft ?? 0) > 0);
};

/**
 * When adding devices with a pairing code is paused for the chain, after repeated
 * refused attempts to join (someone may have the codes), until when; null otherwise.
 */
export const pairingPausedUntil = (chain: Partial<Chain> | null | undefined, now = Date.now()): number | null => {
    const until = chain?.pairingLockedUntil;
    return until && until > now ? until : null;
};

/** True when it's time to ask again whether the person still has their codes. */
export const isCheckInDue = (lastCheckedAt: number | null, now = Date.now()): boolean => {
    if (!lastCheckedAt) return false;
    return now - lastCheckedAt >= CHECK_IN_INTERVAL_MS;
};
