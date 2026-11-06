/**
 * HTTP client for the sync API: sync chains and two-way sync. Requests from a
 * device in a chain carry its own credential as a bearer token; the chain
 * code's secret is only sent when creating or joining a chain.

 */
import type { ReportRow } from '../db/tables';
import type { LocalChanges, RemoteChanges } from './sync.repository';

export interface SyncConnection {
    apiUrl: string;
    credential?: string;
}

export interface ChainAccess {
    chainId: string;
    deviceId: string;
    deviceCredential: string;
    secret?: string;
    recoveryCodes?: string[];
}

export interface ChainDevice {
    id: string;
    name: string;
    createdAt: number;
    lastSeenAt: number;
}

export interface Chain {
    chainId: string;
    deviceId: string;
    devices: ChainDevice[];
    recoveryCodesLeft: number;
    pairingLockedUntil?: number | null;
}

export interface ChainEvent {
    at: number;
    kind: string;
    deviceName: string;
    detail?: string;
}

export type PairingStatus = 'waiting' | 'requested' | 'approved' | 'joined' | 'denied' | 'expired';

export interface Pairing {
    status: PairingStatus;
    requesterName: string;
    expiresAt?: number;
}

export type PairingAnswer =
    | { status: 'requested' | 'denied' | 'expired' }
    | ({ status: 'approved' } & Omit<ChainAccess, 'secret' | 'recoveryCodes'>);

export interface SyncResponse {
    changes?: RemoteChanges;
    cursor: number;
    hasMore?: boolean;
}

export class SyncError extends Error {
    status: number;
    offline: boolean;
    retryAfterMs: number;

    constructor(message: string, { status = 0, offline = false, retryAfterMs = 0 } = {}) {
        super(message);
        this.status = status;
        this.offline = offline;
        this.retryAfterMs = retryAfterMs;
    }
}

const endpoint = (apiUrl: string, path: string): string => {
    return `${(apiUrl || '/api').replace(/\/+$/, '')}${path}`;
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const request = async <T>(url: string, init: RequestInit, timeoutMs = 20000): Promise<T> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
        res = await fetch(url, { ...init, signal: ctrl.signal });
    } catch {
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        throw new SyncError(offline ? "You're offline" : "Can't reach the sync server", { offline });
    } finally {
        clearTimeout(timer);
    }
    if (res.status === 204) return null as T;
    let body: (T & { error?: string }) | null = null;
    try {
        body = (await res.json()) as T & { error?: string };
    } catch {
        /* non-JSON error page */
    }
    if (!res.ok) {
        throw new SyncError(body?.error ? capitalize(body.error) : `Sync server answered ${res.status}`, {
            status: res.status,
            retryAfterMs: res.status === 429 ? Number(res.headers.get('Retry-After') ?? 60) * 1000 : 0,
        });
    }
    if (!body) throw new SyncError('The sync server sent an unexpected response', { status: res.status });
    return body;
};

const json = (method: string, body?: unknown, credential?: string): RequestInit => ({
    method,
    headers: {
        'Content-Type': 'application/json',
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

/** Saves a playlist backup in this device's chain. Sending the same one again changes nothing. */
export const postReport = ({ apiUrl, credential }: SyncConnection, report: ReportRow): Promise<null> => {
    return request(endpoint(apiUrl, '/reports'), json('POST', report, credential));
};

/** A playlist's backups in this device's chain, newest first, without their content. */
export const listReports = (
    { apiUrl, credential }: SyncConnection,
    playlistId: string,
): Promise<Omit<ReportRow, 'content'>[]> => {
    const query = `?playlistId=${encodeURIComponent(playlistId)}`;
    return request(endpoint(apiUrl, `/reports${query}`), json('GET', undefined, credential));
};

/** One backup's JSON report. */
export const getReport = ({ apiUrl, credential }: SyncConnection, id: string): Promise<unknown> => {
    return request(endpoint(apiUrl, `/reports/${encodeURIComponent(id)}`), json('GET', undefined, credential));
};

/** Pushes local changes and pulls server changes newer than `since`, in this device's chain. */
export const postSync = (
    { apiUrl, credential }: SyncConnection,
    payload: { since: number; changes: LocalChanges },
): Promise<SyncResponse> => {
    return request(endpoint(apiUrl, '/sync'), json('POST', payload, credential));
};

export const getHealth = ({ apiUrl }: SyncConnection): Promise<{ syncConfigured: boolean }> => {
    return request(endpoint(apiUrl, '/health'), { method: 'GET' }, 8000);
};

/** Creates a chain with this device in it. Resolves to { chainId, deviceId, deviceCredential, secret, recoveryCodes }. */
export const createChain = ({ apiUrl }: SyncConnection, deviceName: string): Promise<ChainAccess> => {
    return request(endpoint(apiUrl, '/chains'), json('POST', { deviceName }));
};

/** Joins the chain with this code's secret. Resolves to { chainId, deviceId, deviceCredential }. */
export const joinChain = ({ apiUrl }: SyncConnection, secret: string, deviceName: string): Promise<ChainAccess> => {
    return request(endpoint(apiUrl, '/chains/join'), json('POST', { secret, deviceName }));
};

/** Turns the library synced with the old SYNC_TOKEN into a chain, once. Resolves like createChain. */
export const claimLegacyChain = (
    { apiUrl }: SyncConnection,
    syncToken: string,
    deviceName: string,
): Promise<ChainAccess> => {
    return request(endpoint(apiUrl, '/chains/claim'), json('POST', { deviceName }, syncToken));
};

/**
 * Recovers the chain with one of its recovery codes: the chain gets a new code and new
 * recovery codes, every old device is removed and this device joins. Resolves like createChain.
 */
export const recoverChain = (
    { apiUrl }: SyncConnection,
    recoveryCode: string,
    deviceName: string,
): Promise<ChainAccess> => {
    return request(endpoint(apiUrl, '/chains/recover'), json('POST', { recoveryCode, deviceName }));
};

/**
 * This device's chain and its devices:
 * { chainId, deviceId, devices: [{ id, name, createdAt, lastSeenAt }], recoveryCodesLeft }.
 */
export const getChain = ({ apiUrl, credential }: SyncConnection): Promise<Chain> => {
    return request(endpoint(apiUrl, '/chain'), json('GET', undefined, credential));
};

/** Removes a device from this device's chain (this device's own ID leaves the chain). */
export const removeDevice = ({ apiUrl, credential }: SyncConnection, deviceId: string): Promise<null> => {
    return request(
        endpoint(apiUrl, `/chain/devices/${encodeURIComponent(deviceId)}`),
        json('DELETE', undefined, credential),
    );
};

/** A new code and recovery codes for this device's chain; every other device is removed. Resolves to { secret, recoveryCodes }. */
export const replaceChainCode = ({
    apiUrl,
    credential,
}: SyncConnection): Promise<{ secret: string; recoveryCodes: string[] }> => {
    return request(endpoint(apiUrl, '/chain/replace'), json('POST', undefined, credential));
};

/** New recovery codes for this device's chain; the old ones stop working. Resolves to { codes }. */
export const renewRecoveryCodes = ({ apiUrl, credential }: SyncConnection): Promise<{ codes: string[] }> => {
    return request(endpoint(apiUrl, '/chain/recovery-codes'), json('POST', undefined, credential));
};

/** The chain's audit log, newest first: [{ at, kind, deviceName, detail }]. Never includes a secret. */
export const getChainEvents = ({ apiUrl, credential }: SyncConnection, limit = 50): Promise<ChainEvent[]> => {
    return request(endpoint(apiUrl, `/chain/events?limit=${limit}`), json('GET', undefined, credential));
};

/** A new pairing code for this device's chain, replacing this device's previous one. Resolves to { code, expiresAt }. */
export const startPairing = ({ apiUrl, credential }: SyncConnection): Promise<{ code: string; expiresAt: number }> => {
    return request(endpoint(apiUrl, '/chain/pairing'), json('POST', undefined, credential));
};

/** Where this device's pairing code stands: { status, requesterName, expiresAt }; 404 when it has none. */
export const getPairing = ({ apiUrl, credential }: SyncConnection): Promise<Pairing> => {
    return request(endpoint(apiUrl, '/chain/pairing'), json('GET', undefined, credential), 8000);
};

/** Lets the device that entered this device's pairing code join. */
export const approvePairing = ({ apiUrl, credential }: SyncConnection): Promise<null> => {
    return request(endpoint(apiUrl, '/chain/pairing/approve'), json('POST', undefined, credential));
};

/** Refuses the device that entered this device's pairing code. */
export const denyPairing = ({ apiUrl, credential }: SyncConnection): Promise<null> => {
    return request(endpoint(apiUrl, '/chain/pairing/deny'), json('POST', undefined, credential));
};

/** Cancels this device's pairing code. */
export const cancelPairing = ({ apiUrl, credential }: SyncConnection): Promise<null> => {
    return request(endpoint(apiUrl, '/chain/pairing'), json('DELETE', undefined, credential));
};

/**
 * Asks to join the chain whose device showed this pairing code, from a device that
 * isn't in a chain. Resolves to { requestToken, expiresAt }.
 */
export const requestPairing = (
    { apiUrl }: SyncConnection,
    code: string,
    deviceName: string,
): Promise<{ requestToken: string; expiresAt: number }> => {
    return request(endpoint(apiUrl, '/chains/pair'), json('POST', { code, deviceName }));
};

/**
 * Whether the pairing request was approved: { status: 'requested' | 'denied' | 'expired' },
 * or once approved { status: 'approved', chainId, deviceId, deviceCredential }, only once.
 */
export const getPairingStatus = ({ apiUrl }: SyncConnection, requestToken: string): Promise<PairingAnswer> => {
    return request(endpoint(apiUrl, '/pairing/status'), json('POST', undefined, requestToken), 8000);
};

/** Deletes this device's chain, its devices and all its synced data. */
export const deleteChain = ({ apiUrl, credential }: SyncConnection): Promise<null> => {
    return request(endpoint(apiUrl, '/chain'), json('DELETE', undefined, credential));
};
