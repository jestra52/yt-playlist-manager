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
const CODES = Array.from({ length: 10 }, (_, i) => `AAAAA-BBBBB-CCCCC-DDDD${i}`);
const NEW_CODES = Array.from({ length: 10 }, (_, i) => `EEEEE-FFFFF-GGGGG-HHHH${i}`);
const device = { id: 'device-1', name: 'Laptop', createdAt: 1, lastSeenAt: 1 };

let SQL;
let calls;
/** Fake API: chain endpoints and sync; `rejectSync` makes /api/sync answer 401. */
let rejectSync;
/** What GET /api/chain says about the chain's unused recovery codes. */
let recoveryCodesLeft;

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = async (url, init = {}) => {
        const path = String(url);
        const body = init.body ? JSON.parse(init.body) : null;
        calls.push({ path, method: init.method, body, auth: init.headers?.Authorization });
        const access = { chainId: 'chain-1', deviceId: 'device-1', deviceCredential: CREDENTIAL };
        if (path.endsWith('/chains')) return reply(201, { ...access, secret: SECRET, recoveryCodes: CODES });
        if (path.endsWith('/chains/join'))
            return body.secret === SECRET
                ? reply(200, { ...access, secret: null, recoveryCodes: null })
                : reply(401, { error: 'nope' });
        if (path.endsWith('/chains/recover'))
            return body.recoveryCode === CODES[0]
                ? reply(200, { ...access, secret: SECRET, recoveryCodes: NEW_CODES })
                : reply(401, { error: 'that recovery code doesn’t match any sync chain, or it was already used' });
        if (path.endsWith('/chain/recovery-codes')) return reply(200, { codes: NEW_CODES });
        if (path.endsWith('/chain/replace')) return reply(200, { secret: SECRET, recoveryCodes: NEW_CODES });
        if (path.includes('/chain/events'))
            return reply(200, [{ at: 1, kind: 'created', deviceName: 'Laptop', detail: '' }]);
        if (path.endsWith('/chain')) return reply(200, { ...access, devices: [device], recoveryCodesLeft });
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
    recoveryCodesLeft = 10;
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
        expect(sync.newCode).toEqual({ words: secretToWords(SECRET), recoveryCodes: CODES, reason: 'created' });
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

describe('recovery', () => {
    it('recovers with a recovery code, shows the new codes once and merges this device’s library', async () => {
        playlists.create('Kept here');
        expect(await sync.recoverChain('aaaaa bbbbb', 'New phone')).toBe(false);
        expect(calls).toHaveLength(0);
        expect(ui.notices.at(-1)).toMatchObject({ tone: 'error', message: expect.stringMatching(/has 20 characters/) });

        expect(await sync.recoverChain(CODES[1], 'New phone')).toBe(false);
        expect(ui.notices.at(-1).message).toMatch(/already used/);
        expect(sync.configured).toBe(false);

        expect(await sync.recoverChain(CODES[0], 'New phone')).toBe(true);
        expect(calls.findLast((c) => c.path.endsWith('/chains/recover')).body).toEqual({
            recoveryCode: CODES[0],
            deviceName: 'New phone',
        });
        expect(sync.configured).toBe(true);
        expect(sync.newCode).toEqual({ words: secretToWords(SECRET), recoveryCodes: NEW_CODES, reason: 'recovered' });

        await sync.syncNow({ quiet: true });
        const pushed = calls.find((c) => c.path.endsWith('/sync')).body;
        expect(pushed.since).toBe(0);
        expect(pushed.changes.playlists.map((p) => p.name)).toEqual(['Kept here']);
    });

    it('renews the recovery codes, and replacing the code renews them too', async () => {
        await sync.createChain('Laptop');
        sync.codeSaved();

        expect(await sync.renewRecoveryCodes()).toBe(true);
        expect(sync.newCode).toEqual({ recoveryCodes: NEW_CODES, reason: 'recovery-codes' });
        sync.codeSaved();

        expect(await sync.replaceCode()).toBe(true);
        expect(sync.newCode).toEqual({ words: secretToWords(SECRET), recoveryCodes: NEW_CODES, reason: 'replaced' });
    });

    it('reminds a device that is the only way back in, and checks in every 90 days', async () => {
        await sync.createChain('Laptop');
        sync.codeSaved();
        await sync.loadChain();
        expect(sync.recoveryNotice).toBe(false);
        expect(sync.checkInDue).toBe(false);

        recoveryCodesLeft = 0;
        await sync.loadChain();
        expect(sync.recoveryNotice).toBe(true);

        sync.codeCheckedAt = Date.now() - 91 * 24 * 60 * 60 * 1000;
        expect(sync.checkInDue).toBe(true);
        sync.confirmCodeCheckIn();
        expect(sync.checkInDue).toBe(false);
    });

    it('loads the audit log', async () => {
        await sync.createChain('Laptop');
        expect(await sync.loadEvents()).toEqual([{ at: 1, kind: 'created', deviceName: 'Laptop', detail: '' }]);
        expect(calls.find((c) => c.path.includes('/chain/events')).auth).toBe(`Bearer ${CREDENTIAL}`);
    });
});
