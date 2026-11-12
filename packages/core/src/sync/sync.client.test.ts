import { afterEach, describe, expect, it } from 'vitest';
import { getHealth, isOutdatedApp, postSync, setAppVersion, SyncError } from './sync.client';

const settings = { apiUrl: '/api', credential: 'device-credential' };
const realFetch = globalThis.fetch;
let sent: Headers[] = [];

const answer = (status: number, body: unknown) => {
    sent = [];
    globalThis.fetch = (async (_url: string, init: RequestInit = {}) => {
        sent.push(new Headers(init.headers));
        return { ok: status < 400, status, json: async () => body, headers: new Headers() };
    }) as unknown as typeof fetch;
};

afterEach(() => {
    globalThis.fetch = realFetch;
    setAppVersion('');
});

describe('the app version', () => {
    it('goes with every request once set', async () => {
        answer(200, { syncConfigured: true });
        await getHealth(settings);
        expect(sent[0]!.has('X-App-Version')).toBe(false);

        setAppVersion('0.2.0');
        answer(200, { cursor: 1 });
        await postSync(settings, { since: 0, changes: { playlists: [], videos: [] } });
        expect(sent[0]!.get('X-App-Version')).toBe('0.2.0');
        expect(sent[0]!.get('Authorization')).toBe('Bearer device-credential');
    });

    it('tells an outdated app from other errors', async () => {
        answer(426, { error: 'this version of the app is out of date: reload the page to keep syncing' });
        const err = await postSync(settings, { since: 0, changes: { playlists: [], videos: [] } }).catch((e) => e);
        expect(isOutdatedApp(err)).toBe(true);
        expect(err.message).toMatch(/^This version of the app is out of date/);
        expect(isOutdatedApp(new SyncError('nope', { status: 401 }))).toBe(false);
        expect(isOutdatedApp(new Error('offline'))).toBe(false);
    });
});
