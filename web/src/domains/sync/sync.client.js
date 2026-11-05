/**
 * HTTP client for the sync API: sync chains and two-way sync. Requests from a
 * device in a chain carry its own credential as a bearer token; the chain
 * code's secret is only sent when creating or joining a chain.
 *
 * No framework code here: this module is shared as is with other apps (#23).
 */

export class SyncError extends Error {
    constructor(message, { status = 0, offline = false } = {}) {
        super(message);
        this.status = status;
        this.offline = offline;
    }
}

const endpoint = (apiUrl, path) => {
    return `${(apiUrl || '/api').replace(/\/+$/, '')}${path}`;
};

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const request = async (url, init, timeoutMs = 20000) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
        res = await fetch(url, { ...init, signal: ctrl.signal });
    } catch {
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        throw new SyncError(offline ? "You're offline" : "Can't reach the sync server", { offline });
    } finally {
        clearTimeout(timer);
    }
    if (res.status === 204) return null;
    let body = null;
    try {
        body = await res.json();
    } catch {
        /* non-JSON error page */
    }
    if (!res.ok) {
        throw new SyncError(body?.error ? capitalize(body.error) : `Sync server answered ${res.status}`, {
            status: res.status,
        });
    }
    if (!body) throw new SyncError('The sync server sent an unexpected response', { status: res.status });
    return body;
};

const json = (method, body, credential) => ({
    method,
    headers: {
        'Content-Type': 'application/json',
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

/** Pushes local changes and pulls server changes newer than `since`, in this device's chain. */
export const postSync = ({ apiUrl, credential }, payload) => {
    return request(endpoint(apiUrl, '/sync'), json('POST', payload, credential));
};

export const getHealth = ({ apiUrl }) => {
    return request(endpoint(apiUrl, '/health'), { method: 'GET' }, 8000);
};

/** Creates a chain with this device in it. Resolves to { chainId, deviceId, deviceCredential, secret, recoveryCodes }. */
export const createChain = ({ apiUrl }, deviceName) => {
    return request(endpoint(apiUrl, '/chains'), json('POST', { deviceName }));
};

/** Joins the chain with this code's secret. Resolves to { chainId, deviceId, deviceCredential }. */
export const joinChain = ({ apiUrl }, secret, deviceName) => {
    return request(endpoint(apiUrl, '/chains/join'), json('POST', { secret, deviceName }));
};

/** Turns the library synced with the old SYNC_TOKEN into a chain, once. Resolves like createChain. */
export const claimLegacyChain = ({ apiUrl }, syncToken, deviceName) => {
    return request(endpoint(apiUrl, '/chains/claim'), json('POST', { deviceName }, syncToken));
};

/**
 * Recovers the chain with one of its recovery codes: the chain gets a new code and new
 * recovery codes, every old device is removed and this device joins. Resolves like createChain.
 */
export const recoverChain = ({ apiUrl }, recoveryCode, deviceName) => {
    return request(endpoint(apiUrl, '/chains/recover'), json('POST', { recoveryCode, deviceName }));
};

/**
 * This device's chain and its devices:
 * { chainId, deviceId, devices: [{ id, name, createdAt, lastSeenAt }], recoveryCodesLeft }.
 */
export const getChain = ({ apiUrl, credential }) => {
    return request(endpoint(apiUrl, '/chain'), json('GET', undefined, credential));
};

/** Removes a device from this device's chain (this device's own ID leaves the chain). */
export const removeDevice = ({ apiUrl, credential }, deviceId) => {
    return request(
        endpoint(apiUrl, `/chain/devices/${encodeURIComponent(deviceId)}`),
        json('DELETE', undefined, credential),
    );
};

/** A new code and recovery codes for this device's chain; every other device is removed. Resolves to { secret, recoveryCodes }. */
export const replaceChainCode = ({ apiUrl, credential }) => {
    return request(endpoint(apiUrl, '/chain/replace'), json('POST', undefined, credential));
};

/** New recovery codes for this device's chain; the old ones stop working. Resolves to { codes }. */
export const renewRecoveryCodes = ({ apiUrl, credential }) => {
    return request(endpoint(apiUrl, '/chain/recovery-codes'), json('POST', undefined, credential));
};

/** The chain's audit log, newest first: [{ at, kind, deviceName, detail }]. Never includes a secret. */
export const getChainEvents = ({ apiUrl, credential }, limit = 50) => {
    return request(endpoint(apiUrl, `/chain/events?limit=${limit}`), json('GET', undefined, credential));
};

/** A new pairing code for this device's chain, replacing this device's previous one. Resolves to { code, expiresAt }. */
export const startPairing = ({ apiUrl, credential }) => {
    return request(endpoint(apiUrl, '/chain/pairing'), json('POST', undefined, credential));
};

/** Where this device's pairing code stands: { status, requesterName, expiresAt }; 404 when it has none. */
export const getPairing = ({ apiUrl, credential }) => {
    return request(endpoint(apiUrl, '/chain/pairing'), json('GET', undefined, credential), 8000);
};

/** Lets the device that entered this device's pairing code join. */
export const approvePairing = ({ apiUrl, credential }) => {
    return request(endpoint(apiUrl, '/chain/pairing/approve'), json('POST', undefined, credential));
};

/** Refuses the device that entered this device's pairing code. */
export const denyPairing = ({ apiUrl, credential }) => {
    return request(endpoint(apiUrl, '/chain/pairing/deny'), json('POST', undefined, credential));
};

/** Cancels this device's pairing code. */
export const cancelPairing = ({ apiUrl, credential }) => {
    return request(endpoint(apiUrl, '/chain/pairing'), json('DELETE', undefined, credential));
};

/**
 * Asks to join the chain whose device showed this pairing code, from a device that
 * isn't in a chain. Resolves to { requestToken, expiresAt }.
 */
export const requestPairing = ({ apiUrl }, code, deviceName) => {
    return request(endpoint(apiUrl, '/chains/pair'), json('POST', { code, deviceName }));
};

/**
 * Whether the pairing request was approved: { status: 'requested' | 'denied' | 'expired' },
 * or once approved { status: 'approved', chainId, deviceId, deviceCredential }, only once.
 */
export const getPairingStatus = ({ apiUrl }, requestToken) => {
    return request(endpoint(apiUrl, '/pairing/status'), json('POST', undefined, requestToken), 8000);
};

/** Deletes this device's chain, its devices and all its synced data. */
export const deleteChain = ({ apiUrl, credential }) => {
    return request(endpoint(apiUrl, '/chain'), json('DELETE', undefined, credential));
};
