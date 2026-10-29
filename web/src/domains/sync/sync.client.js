/** HTTP client for the Go sync API. */

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
    let body = null;
    try {
        body = await res.json();
    } catch {
        /* non-JSON error page */
    }
    if (!res.ok) {
        const message =
            res.status === 401
                ? 'The sync token was rejected. Check it in sync settings.'
                : (body?.error ?? `Sync server answered ${res.status}`);
        throw new SyncError(message, { status: res.status });
    }
    if (!body) throw new SyncError('The sync server sent an unexpected response', { status: res.status });
    return body;
};

/** Pushes local changes and pulls server changes newer than `since`. */
export const postSync = ({ apiUrl, token }, payload) => {
    return request(endpoint(apiUrl, '/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
    });
};

export const getHealth = ({ apiUrl }) => {
    return request(endpoint(apiUrl, '/health'), { method: 'GET' }, 8000);
};
