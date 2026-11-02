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
        throw new SyncError(offline ? 'You’re offline' : 'Can’t reach the sync server', { offline });
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

/** Creates a chain with this device in it. Resolves to { chainId, deviceId, deviceCredential, secret }. */
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

/** This device's chain and its devices: { chainId, deviceId, devices: [{ id, name, createdAt, lastSeenAt }] }. */
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

/** A new code for this device's chain; every other device is removed. Resolves to { secret }. */
export const replaceChainCode = ({ apiUrl, credential }) => {
    return request(endpoint(apiUrl, '/chain/replace'), json('POST', undefined, credential));
};

/** Deletes this device's chain, its devices and all its synced data. */
export const deleteChain = ({ apiUrl, credential }) => {
    return request(endpoint(apiUrl, '/chain'), json('DELETE', undefined, credential));
};
