import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import initSqlJs from 'sql.js';
import { Database } from '../../core/db/database.js';
import { setDatabase } from '../../core/db/index.js';
import { playlists } from '../playlists/playlists.service.svelte.js';
import { videos } from '../videos/videos.service.svelte.js';
import { ui } from '../ui/ui.service.svelte.js';
import { secretToWords } from './chain-code.js';
import { sync } from './sync.service.svelte.js';

const SECRET = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const CREDENTIAL = 'Y3JlZGVudGlhbC1jcmVkZW50aWFsLWNyZWRlbnRpYWw';

let SQL;
let calls;
/** Fake API: chain endpoints and sync; `rejectSync` makes /api/sync answer 401. */
let rejectSync;

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = async (url, init = {}) => {
        const path = String(url);
        const body = init.body ? JSON.parse(init.body) : null;
        calls.push({ path, method: init.method, body, auth: init.headers?.Authorization });
        const access = { chainId: 'chain-1', deviceId: 'device-1', deviceCredential: CREDENTIAL };
        if (path.endsWith('/chains')) return reply(201, { ...access, secret: SECRET });
        if (path.endsWith('/chains/join'))
            return body.secret === SECRET ? reply(200, { ...access, secret: null }) : reply(401, { error: 'nope' });
        if (path.endsWith('/chain')) return reply(200, { ...access, devices: [] });
        if (path.endsWith('/sync'))
            return rejectSync
                ? reply(401, { error: 'this device isn’t in a sync chain' })
                : reply(200, { cursor: 7, hasMore: false, applied: 0, changes: {} });
        return reply(404, { error: 'not found' });
    };
});

beforeEach(() => {
    calls = [];
    rejectSync = false;
    setDatabase(new Database(new SQL.Database()));
    playlists.load();
    videos.load();
    sync.load();
    sync.codeSaved();
});

describe('sync chains', () => {
    it('creates a chain, shows its code once, and syncs with the device credential', async () => {
        expect(sync.configured).toBe(false);
        expect(await sync.createChain('Laptop')).toBe(true);

        expect(sync.configured).toBe(true);
        expect(sync.newCode).toEqual({ words: secretToWords(SECRET), reason: 'created' });
        expect(sync.settings).toMatchObject({ chainId: 'chain-1', deviceId: 'device-1', credential: CREDENTIAL });
        expect(calls[0]).toMatchObject({ method: 'POST', body: { deviceName: 'Laptop' } });

        await sync.syncNow({ quiet: true });
        const syncCall = calls.find((c) => c.path.endsWith('/sync'));
        expect(syncCall.auth).toBe(`Bearer ${CREDENTIAL}`);

        sync.codeSaved();
        expect(sync.newCode).toBeNull();
    });

    it('joins with the 24 words, and never sends a mistyped code', async () => {
        const words = secretToWords(SECRET);
        expect(await sync.joinChain(words.slice(0, 23).join(' ') + ' zoo', 'Phone')).toBe(false);
        expect(calls).toHaveLength(0);
        expect(ui.notices.at(-1).tone).toBe('error');

        expect(await sync.joinChain(words.join(' '), 'Phone')).toBe(true);
        expect(calls[0].body).toEqual({ secret: SECRET, deviceName: 'Phone' });
        expect(sync.newCode).toBeNull();
        expect(sync.configured).toBe(true);
    });

    it('leaves the chain when the server no longer knows this device, keeping the playlists', async () => {
        await sync.createChain('Laptop');
        sync.codeSaved();
        playlists.create('Mine');
        // Creating a chain starts a sync; let it finish before the server forgets the device.
        await sync.syncNow({ quiet: true });

        rejectSync = true;
        expect(await sync.syncNow({ quiet: true })).toBe(false);
        expect(sync.configured).toBe(false);
        expect(sync.status).toBe('idle');
        expect(ui.notices.at(-1).message).toContain('no longer in the sync chain');
        expect(playlists.items.map((p) => p.name)).toEqual(['Mine']);
    });
});
