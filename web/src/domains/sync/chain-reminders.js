/**
 * When to remind people of the ways back into their sync chain, so they don't end
 * up with no device and no code: a notice when nothing is left to recover with, and
 * an occasional check-in that they still have their codes.
 *
 * No framework code here: this module is shared as is with other apps (#23).
 */

export const CHECK_IN_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * True when losing this device would lose the chain: it's the only device, and the
 * chain has no unused recovery codes (passkeys, #57, will count here too).
 */
export const needsRecoveryNotice = (chain) => {
    if (!chain?.devices) return false;
    return chain.devices.length <= 1 && !(chain.recoveryCodesLeft > 0);
};

/** True when it's time to ask again whether the person still has their codes. */
export const isCheckInDue = (lastCheckedAt, now = Date.now()) => {
    if (!lastCheckedAt) return false;
    return now - lastCheckedAt >= CHECK_IN_INTERVAL_MS;
};
