import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
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
/** What GET /api/chain says about the chain's unused recovery codes, and whether pairing is paused. */
let recoveryCodesLeft;
let pairingLockedUntil;
/** What GET /api/chain/pairing and POST /api/pairing/status answer. */
let pairingInfo;
let pairingAnswer;
const PAIRING_CODE = '7K3Q-D9X2';
const REQUEST_TOKEN = 'cmVxdWVzdC1yZXF1ZXN0LXJlcXVlc3QtcmVxdWVzdC0';

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = async (url, init = {}) => {
        const path = String(url);
        const body = init.body ? JSON.parse(init.body) : null;
        calls.push({ path, method: init.method, body, auth: init.headers?.Authorization });
        const access = { chainId: 'chain-1', deviceId: 'device-1', deviceCredential: CREDENTIAL };
        if (path.endsWith('/chain/pairing') && init.method === 'POST')
            return reply(201, { code: PAIRING_CODE, expiresAt: Date.now() + 600_000 });
        if (path.endsWith('/chain/pairing') && init.method === 'GET') return reply(200, pairingInfo);
        if (path.includes('/chain/pairing')) return reply(204, null);
        if (path.endsWith('/chains/pair'))
            return body.code === PAIRING_CODE
                ? reply(202, { requestToken: REQUEST_TOKEN, expiresAt: Date.now() + 300_000 })
                : reply(401, { error: 'that pairing code doesn’t match, has expired or was already used' });
        if (path.endsWith('/pairing/status')) return reply(200, pairingAnswer);
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
        if (path.endsWith('/chain'))
            return reply(200, { ...access, devices: [device], recoveryCodesLeft, pairingLockedUntil });
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
    pairingLockedUntil = null;
    pairingInfo = { status: 'waiting', requesterName: '', expiresAt: Date.now() + 600_000 };
    pairingAnswer = { status: 'requested' };
    sync.cancelPairing();
    sync.cancelJoinRequest();
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

describe('adding a device with a pairing code', () => {
    it('shows a code on this device and asks to approve the device that entered it', async () => {
        await sync.createChain('Laptop');
        sync.codeSaved();
        const approveBy = Date.now() + 300_000;
        pairingInfo = { status: 'requested', requesterName: 'Chrome on Android', expiresAt: approveBy };

        expect(await sync.startPairing()).toBe(true);
        expect(sync.pairing.code).toBe(PAIRING_CODE);
        await vi.waitFor(() => expect(sync.pairing.status).toBe('requested'));
        expect(sync.pairing).toMatchObject({ requesterName: 'Chrome on Android', expiresAt: approveBy });

        expect(await sync.approvePairing()).toBe(true);
        expect(sync.pairing.status).toBe('approved');
        const approve = calls.find((c) => c.path.endsWith('/chain/pairing/approve'));
        expect(approve).toMatchObject({ method: 'POST', auth: `Bearer ${CREDENTIAL}` });

        sync.cancelPairing();
        expect(sync.pairing).toBeNull();
    });

    it('joins on the new device once approved, without the chain code', async () => {
        playlists.create('Phone list');
        expect(await sync.joinWithPairingCode('7K3Q', 'Phone')).toBe(false);
        expect(calls).toHaveLength(0);

        pairingAnswer = { status: 'approved', chainId: 'chain-1', deviceId: 'device-2', deviceCredential: CREDENTIAL };
        expect(await sync.joinWithPairingCode('7k3qd9x2', 'Phone')).toBe(true);
        expect(calls[0]).toMatchObject({ method: 'POST', body: { code: PAIRING_CODE, deviceName: 'Phone' } });
        expect(calls[1]).toMatchObject({ method: 'POST', auth: `Bearer ${REQUEST_TOKEN}` });
        expect(sync.settings).toMatchObject({ chainId: 'chain-1', deviceId: 'device-2', credential: CREDENTIAL });
        expect(sync.newCode).toBeNull();
        expect(sync.joinRequest).toBeNull();
    });

    it('says when the request was refused, and refuses a wrong code', async () => {
        pairingAnswer = { status: 'denied' };
        expect(await sync.joinWithPairingCode(PAIRING_CODE, 'Phone')).toBe(false);
        expect(sync.joinRequest.status).toBe('denied');
        expect(sync.configured).toBe(false);

        expect(await sync.joinWithPairingCode('0000-0000', 'Phone')).toBe(false);
        expect(ui.notices.at(-1)).toMatchObject({ tone: 'error', message: expect.stringMatching(/pairing code/) });
    });

    it('warns once when pairing is paused for the chain', async () => {
        await sync.createChain('Laptop');
        sync.codeSaved();
        pairingLockedUntil = Date.now() + 3_600_000;
        await sync.loadChain();
        expect(sync.pairingPaused).toBe(pairingLockedUntil);
        expect(ui.notices.at(-1).message).toMatch(/paused until/);
        const notices = ui.notices.length;
        await sync.loadChain();
        expect(ui.notices.length).toBe(notices);
    });
});
