/**
 * Adding a device with a pairing code: the device in the chain follows its code
 * until a new device enters it (and asks the person to approve), and the new
 * device waits for that approval, then gets its own credential. Both sides ask
 * the server every couple of seconds; the request token never leaves memory.
 *
 * No framework code here: this module is shared as is with other apps (#23).
 */
import { SyncError, getPairing, getPairingStatus } from './sync.client.js';

export const PAIRING_POLL_MS = 2000;

/** Statuses after which nothing more happens to a pairing. */
const FINAL = new Set(['joined', 'denied', 'expired']);

const sleep = (ms, signal) => {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
        });
    });
};

/** A dropped connection is worth asking again; anything else ends the wait. */
const retriable = (err) => err instanceof SyncError && err.status === 0;

/**
 * Follows this device's pairing code: calls `onChange` with { status, requesterName,
 * expiresAt } each time its status changes, until it's joined, denied or expired
 * (a cancelled code counts as expired), or `signal` aborts. Resolves to the last status.
 */
export const watchPairing = async (settings, { signal, onChange, intervalMs = PAIRING_POLL_MS } = {}) => {
    let last = null;
    while (!signal?.aborted) {
        let pairing;
        try {
            pairing = await getPairing(settings);
        } catch (err) {
            if (err instanceof SyncError && err.status === 404) pairing = { status: 'expired', requesterName: '' };
            else if (!retriable(err)) throw err;
        }
        if (signal?.aborted) break;
        if (pairing && pairing.status !== last?.status) {
            last = pairing;
            onChange?.(pairing);
        }
        if (FINAL.has(last?.status)) break;
        await sleep(intervalMs, signal);
    }
    return last;
};

/**
 * Waits until the device that made the pairing code approves or denies this
 * device's request, or the request expires. Resolves to the final answer
 * ({ status: 'approved', chainId, deviceId, deviceCredential }, or { status:
 * 'denied' | 'expired' }), or null when `signal` aborts first.
 */
export const waitForApproval = async (settings, requestToken, { signal, intervalMs = PAIRING_POLL_MS } = {}) => {
    while (!signal?.aborted) {
        try {
            const result = await getPairingStatus(settings, requestToken);
            if (result.status !== 'requested') return result;
        } catch (err) {
            if (!retriable(err)) throw err;
        }
        await sleep(intervalMs, signal);
    }
    return null;
};

/** Time left until `expiresAt` as m:ss, never below 0:00. */
export const countdown = (expiresAt, now = Date.now()) => {
    const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
