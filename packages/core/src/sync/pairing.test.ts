import { describe, it, expect, beforeEach } from 'vitest';
import { countdown, waitForApproval, watchPairing } from './pairing';

const settings = { apiUrl: '/api', credential: 'device-credential' };
const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

/** Fake API answering each request with the next reply of `replies` (the last one repeats). */
let replies: (ReturnType<typeof reply> | 'offline')[];
let calls: { path: string; method?: string; auth?: string }[];

beforeEach(() => {
    calls = [];
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
        calls.push({
            path: String(url),
            method: init.method,
            auth: new Headers(init.headers).get('Authorization') ?? undefined,
        });
        const next = replies.length > 1 ? replies.shift() : replies[0];
        if (next === 'offline') throw new TypeError('Failed to fetch');
        return next;
    }) as unknown as typeof fetch;
});

describe("following this device's pairing code", () => {
    it('reports each new status until the new device joins', async () => {
        replies = [
            reply(200, { status: 'waiting', requesterName: '', expiresAt: 9 }),
            reply(200, { status: 'waiting', requesterName: '', expiresAt: 9 }),
            'offline',
            reply(200, { status: 'requested', requesterName: 'Chrome on Android', expiresAt: 9 }),
            reply(200, { status: 'approved', requesterName: 'Chrome on Android', expiresAt: 9 }),
            reply(200, { status: 'joined', requesterName: 'Chrome on Android', expiresAt: 9 }),
        ];
        const seen: string[] = [];
        const last = await watchPairing(settings, { intervalMs: 0, onChange: (p) => seen.push(p.status) });
        expect(seen).toEqual(['waiting', 'requested', 'approved', 'joined']);
        expect(last?.requesterName).toBe('Chrome on Android');
        expect(calls[0]).toMatchObject({ path: '/api/chain/pairing', method: 'GET', auth: 'Bearer device-credential' });
    });

    it('treats a cancelled code as expired, and stops when aborted', async () => {
        replies = [reply(404, { error: 'this device has no pairing code' })];
        expect((await watchPairing(settings, { intervalMs: 0 }))?.status).toBe('expired');

        replies = [reply(200, { status: 'waiting', requesterName: '', expiresAt: 9 })];
        const ctrl = new AbortController();
        const watching = watchPairing(settings, { signal: ctrl.signal, intervalMs: 60_000 });
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        ctrl.abort();
        expect((await watching)?.status).toBe('waiting');
    });
});

describe('waiting for approval on the new device', () => {
    it("asks with the request token until it's decided", async () => {
        replies = [
            reply(200, { status: 'requested' }),
            reply(200, { status: 'approved', chainId: 'c', deviceId: 'd', deviceCredential: 'k' }),
        ];
        const result = await waitForApproval({ apiUrl: '/api' }, 'request-token', { intervalMs: 0 });
        expect(result).toEqual({ status: 'approved', chainId: 'c', deviceId: 'd', deviceCredential: 'k' });
        expect(calls).toHaveLength(2);
        expect(calls[0]).toMatchObject({ path: '/api/pairing/status', method: 'POST', auth: 'Bearer request-token' });
    });

    it('ends on a refusal, an unknown request or an abort', async () => {
        replies = [reply(200, { status: 'denied' })];
        expect(await waitForApproval(settings, 'token', { intervalMs: 0 })).toEqual({ status: 'denied' });

        replies = [reply(401, { error: 'unknown pairing request' })];
        await expect(waitForApproval(settings, 'token', { intervalMs: 0 })).rejects.toThrow('Unknown pairing request');

        const ctrl = new AbortController();
        ctrl.abort();
        expect(await waitForApproval(settings, 'token', { signal: ctrl.signal })).toBeNull();
    });
});

describe('countdown', () => {
    it('shows minutes and seconds left', () => {
        expect(countdown(600_000, 0)).toBe('10:00');
        expect(countdown(61_500, 0)).toBe('1:02');
        expect(countdown(0, 5000)).toBe('0:00');
    });
});
