import { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import { secretToWords } from '@ytpm/core/sync/chain-code';
import type { RemoteChanges } from '@ytpm/core/sync/sync.repository';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, type AppStore } from '../../app/store';
import { selectSelectedPlaylist } from '../playlists/playlists.selectors';
import { createPlaylist, importFromYouTube, selectPlaylist } from '../playlists/playlists.thunks';
import { selectAllVideos, selectPlaying } from '../videos/videos.selectors';
import { played } from '../videos/videos.slice';
import { addEntries } from '../videos/videos.thunks';
import {
    codeSaved,
    createChain,
    joinChain,
    loadEvents,
    recoverChain,
    renewRecoveryCodes,
    replaceCode,
} from './chain.thunks';
import { approvePairing, cancelJoinRequest, cancelPairing, joinWithPairingCode, startPairing } from './pairing.thunks';
import {
    selectCheckInDue,
    selectConfigured,
    selectPairingPaused,
    selectRecoveryNotice,
    selectSyncSettings,
} from './sync.selectors';
import { startAutoSync } from './auto-sync';
import { codeChecked, syncFinished, syncRequested } from './sync.slice';
import { checkedCodes, loadChain, loadSync, saveSyncSettings, syncNow } from './sync.thunks';

const SECRET = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const CREDENTIAL = 'Y3JlZGVudGlhbC1jcmVkZW50aWFsLWNyZWRlbnRpYWw';
const CODES = Array.from({ length: 10 }, (_, i) => `AAAAA-BBBBB-CCCCC-DDDD${i}`);
const NEW_CODES = Array.from({ length: 10 }, (_, i) => `EEEEE-FFFFF-GGGGG-HHHH${i}`);
const PAIRING_CODE = '7K3Q-D9X2';
const REQUEST_TOKEN = 'cmVxdWVzdC1yZXF1ZXN0LXJlcXVlc3QtcmVxdWVzdC0';
const device = { id: 'device-1', name: 'Laptop', createdAt: 1, lastSeenAt: 1 };
const access = { chainId: 'chain-1', deviceId: 'device-1', deviceCredential: CREDENTIAL };

interface Body {
    code?: string;
    secret?: string;
    recoveryCode?: string;
    since?: number;
    changes?: { playlists: { name: string }[] };
}

interface Call {
    path: string;
    method?: string;
    body: Body | null;
    auth?: string;
}

const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let store: AppStore;
let calls: Call[];
let rejectSync: boolean;
let recoveryCodesLeft: number;
let pairingLockedUntil: number | null;
let pairingInfo: object;
let pairingAnswer: object;
let incoming: RemoteChanges;

const reply = (status: number, body: unknown) => new Response(status === 204 ? null : JSON.stringify(body), { status });

const answer = (path: string, method: string | undefined, body: Call['body']): Response => {
    if (path.endsWith('/chain/pairing') && method === 'POST') {
        return reply(201, { code: PAIRING_CODE, expiresAt: Date.now() + 600_000 });
    }
    if (path.endsWith('/chain/pairing') && method === 'GET') return reply(200, pairingInfo);
    if (path.includes('/chain/pairing')) return reply(204, null);
    if (path.endsWith('/chains/pair')) {
        return body?.code === PAIRING_CODE
            ? reply(202, { requestToken: REQUEST_TOKEN, expiresAt: Date.now() + 300_000 })
            : reply(401, { error: "that pairing code doesn't match, has expired or was already used" });
    }
    if (path.endsWith('/pairing/status')) return reply(200, pairingAnswer);
    if (path.endsWith('/chains')) return reply(201, { ...access, secret: SECRET, recoveryCodes: CODES });
    if (path.endsWith('/chains/join')) {
        return body?.secret === SECRET
            ? reply(200, { ...access, secret: null, recoveryCodes: null })
            : reply(401, { error: 'nope' });
    }
    if (path.endsWith('/chains/recover')) {
        return body?.recoveryCode === CODES[0]
            ? reply(200, { ...access, secret: SECRET, recoveryCodes: NEW_CODES })
            : reply(401, { error: "that recovery code doesn't match any sync chain, or it was already used" });
    }
    if (path.endsWith('/chain/recovery-codes')) return reply(200, { codes: NEW_CODES });
    if (path.endsWith('/chain/replace')) return reply(200, { secret: SECRET, recoveryCodes: NEW_CODES });
    if (path.includes('/chain/events')) {
        return reply(200, [{ at: 1, kind: 'created', deviceName: 'Laptop', detail: '' }]);
    }
    if (path.endsWith('/chain')) {
        return reply(200, { ...access, devices: [device], recoveryCodesLeft, pairingLockedUntil });
    }
    if (path.endsWith('/sync')) {
        if (rejectSync) return reply(401, { error: "this device isn't in a sync chain" });
        const changes = incoming;
        incoming = {};
        return reply(200, { cursor: 7, hasMore: false, applied: 0, changes });
    }
    return reply(404, { error: 'not found' });
};

const sync = () => store.getState().sync;
const lastNotice = () => store.getState().ui.notices.at(-1);
const syncCalls = () => calls.filter((c) => c.path.endsWith('/sync'));
const inChain = async () => {
    await store.dispatch(createChain('Laptop'));
    store.dispatch(codeSaved());
    await store.dispatch(syncNow({ quiet: true }));
};

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
        const path = String(url);
        const body = init.body ? JSON.parse(init.body as string) : null;
        const auth = (init.headers as Record<string, string> | undefined)?.Authorization;
        calls.push({ path, method: init.method, body, auth });
        return answer(path, init.method, body);
    }) as typeof fetch;
});

afterAll(() => {
    globalThis.fetch = realFetch;
});

// A sync still waiting from this test must not land in the next one.
afterEach(() => {
    store.dispatch(saveSyncSettings({ apiUrl: '/api', autoSync: false }));
});

beforeEach(() => {
    calls = [];
    rejectSync = false;
    recoveryCodesLeft = 10;
    pairingLockedUntil = null;
    pairingInfo = { status: 'waiting', requesterName: '', expiresAt: Date.now() + 600_000 };
    pairingAnswer = { status: 'requested' };
    incoming = {};
    setDatabase(new Database(new SQL.Database()));
    store = createStore();
    store.dispatch(cancelPairing());
    store.dispatch(cancelJoinRequest());
    store.dispatch(loadSync());
});

describe('sync chains', () => {
    it('creates a chain, shows its code once, and syncs with the device credential', async () => {
        expect(selectConfigured(store.getState())).toBe(false);
        expect(await store.dispatch(createChain('Laptop'))).toBe(true);

        expect(selectConfigured(store.getState())).toBe(true);
        expect(sync().newCode).toEqual({ words: secretToWords(SECRET), recoveryCodes: CODES, reason: 'created' });
        expect(selectSyncSettings(store.getState())).toMatchObject({
            chainId: 'chain-1',
            deviceId: 'device-1',
            credential: CREDENTIAL,
        });
        expect(calls[0]).toMatchObject({ method: 'POST', body: { deviceName: 'Laptop' } });

        await store.dispatch(syncNow({ quiet: true }));
        expect(syncCalls()[0]?.auth).toBe(`Bearer ${CREDENTIAL}`);

        store.dispatch(codeSaved());
        expect(sync().newCode).toBeNull();
    });

    it('joins with the 24 words, and never sends a mistyped code', async () => {
        const words = secretToWords(SECRET);
        expect(await store.dispatch(joinChain(`${words.slice(0, 23).join(' ')} zoo`, 'Phone'))).toBe(false);
        expect(calls).toHaveLength(0);
        expect(lastNotice()?.tone).toBe('error');

        expect(await store.dispatch(joinChain(words.join(' '), 'Phone'))).toBe(true);
        expect(calls[0]?.body).toEqual({ secret: SECRET, deviceName: 'Phone' });
        expect(sync().newCode).toBeNull();
        expect(selectConfigured(store.getState())).toBe(true);
    });

    it('leaves the chain when the server no longer knows this device, keeping the playlists', async () => {
        await inChain();
        store.dispatch(createPlaylist({ name: 'Mine' }));
        await store.dispatch(syncNow({ quiet: true }));

        rejectSync = true;
        expect(await store.dispatch(syncNow({ quiet: true }))).toBe(false);
        expect(selectConfigured(store.getState())).toBe(false);
        expect(sync().status).toBe('idle');
        expect(lastNotice()?.message).toContain('no longer in the sync chain');
        expect(selectSelectedPlaylist(store.getState())?.name).toBe('Mine');
    });
});

describe('recovery', () => {
    it("recovers with a recovery code, shows the new codes once and merges this device's library", async () => {
        store.dispatch(createPlaylist({ name: 'Kept here' }));
        expect(await store.dispatch(recoverChain('aaaaa bbbbb', 'New phone'))).toBe(false);
        expect(calls).toHaveLength(0);
        expect(lastNotice()).toMatchObject({ tone: 'error', message: expect.stringMatching(/has 20 characters/) });

        expect(await store.dispatch(recoverChain(CODES[1]!, 'New phone'))).toBe(false);
        expect(lastNotice()?.message).toMatch(/already used/);
        expect(selectConfigured(store.getState())).toBe(false);

        expect(await store.dispatch(recoverChain(CODES[0]!, 'New phone'))).toBe(true);
        expect(calls.filter((c) => c.path.endsWith('/chains/recover')).at(-1)?.body).toEqual({
            recoveryCode: CODES[0],
            deviceName: 'New phone',
        });
        expect(sync().newCode).toEqual({ words: secretToWords(SECRET), recoveryCodes: NEW_CODES, reason: 'recovered' });

        await store.dispatch(syncNow({ quiet: true }));
        const pushed = syncCalls()[0]?.body;
        expect(pushed?.since).toBe(0);
        expect(pushed?.changes?.playlists.map((p) => p.name)).toEqual(['Kept here']);
    });

    it('renews the recovery codes, and replacing the code renews them too', async () => {
        await inChain();

        expect(await store.dispatch(renewRecoveryCodes())).toBe(true);
        expect(sync().newCode).toEqual({ recoveryCodes: NEW_CODES, reason: 'recovery-codes' });
        store.dispatch(codeSaved());

        expect(await store.dispatch(replaceCode())).toBe(true);
        expect(sync().newCode).toEqual({ words: secretToWords(SECRET), recoveryCodes: NEW_CODES, reason: 'replaced' });
    });

    it('reminds a device that is the only way back in, and checks in every 90 days', async () => {
        await inChain();
        await store.dispatch(loadChain());
        expect(selectRecoveryNotice(store.getState())).toBe(false);
        expect(selectCheckInDue(store.getState())).toBe(false);

        recoveryCodesLeft = 0;
        await store.dispatch(loadChain());
        expect(selectRecoveryNotice(store.getState())).toBe(true);

        store.dispatch(codeChecked(Date.now() - 91 * 24 * 60 * 60 * 1000));
        expect(selectCheckInDue(store.getState())).toBe(true);
        store.dispatch(checkedCodes());
        expect(selectCheckInDue(store.getState())).toBe(false);
    });

    it('loads the audit log', async () => {
        await store.dispatch(createChain('Laptop'));
        expect(await store.dispatch(loadEvents())).toEqual([
            { at: 1, kind: 'created', deviceName: 'Laptop', detail: '' },
        ]);
        expect(calls.find((c) => c.path.includes('/chain/events'))?.auth).toBe(`Bearer ${CREDENTIAL}`);
    });
});

describe('adding a device with a pairing code', () => {
    it('shows a code on this device and asks to approve the device that entered it', async () => {
        await inChain();
        const approveBy = Date.now() + 300_000;
        pairingInfo = { status: 'requested', requesterName: 'Chrome on Android', expiresAt: approveBy };

        expect(await store.dispatch(startPairing())).toBe(true);
        expect(sync().pairing?.code).toBe(PAIRING_CODE);
        await vi.waitFor(() => expect(sync().pairing?.status).toBe('requested'));
        expect(sync().pairing).toMatchObject({ requesterName: 'Chrome on Android', expiresAt: approveBy });

        expect(await store.dispatch(approvePairing())).toBe(true);
        expect(sync().pairing?.status).toBe('approved');
        expect(calls.find((c) => c.path.endsWith('/chain/pairing/approve'))).toMatchObject({
            method: 'POST',
            auth: `Bearer ${CREDENTIAL}`,
        });

        store.dispatch(cancelPairing());
        expect(sync().pairing).toBeNull();
    });

    it('joins on the new device once approved, without the chain code', async () => {
        expect(await store.dispatch(joinWithPairingCode('7K3Q', 'Phone'))).toBe(false);
        expect(calls).toHaveLength(0);

        pairingAnswer = { status: 'approved', chainId: 'chain-1', deviceId: 'device-2', deviceCredential: CREDENTIAL };
        expect(await store.dispatch(joinWithPairingCode('7k3qd9x2', 'Phone'))).toBe(true);
        expect(calls[0]).toMatchObject({ method: 'POST', body: { code: PAIRING_CODE, deviceName: 'Phone' } });
        expect(calls[1]).toMatchObject({ method: 'POST', auth: `Bearer ${REQUEST_TOKEN}` });
        expect(selectSyncSettings(store.getState())).toMatchObject({ deviceId: 'device-2', credential: CREDENTIAL });
        expect(sync().newCode).toBeNull();
        expect(sync().joinRequest).toBeNull();
    });

    it('says when the request was refused, and refuses a wrong code', async () => {
        pairingAnswer = { status: 'denied' };
        expect(await store.dispatch(joinWithPairingCode(PAIRING_CODE, 'Phone'))).toBe(false);
        expect(sync().joinRequest?.status).toBe('denied');
        expect(selectConfigured(store.getState())).toBe(false);

        expect(await store.dispatch(joinWithPairingCode('0000-0000', 'Phone'))).toBe(false);
        expect(lastNotice()).toMatchObject({ tone: 'error', message: expect.stringMatching(/pairing code/) });
    });

    it('warns once when pairing is paused for the chain', async () => {
        await inChain();
        pairingLockedUntil = Date.now() + 3_600_000;
        await store.dispatch(loadChain());
        expect(selectPairingPaused(store.getState())).toBe(pairingLockedUntil);
        expect(lastNotice()?.message).toMatch(/paused until/);
        const notices = store.getState().ui.notices.length;
        await store.dispatch(loadChain());
        expect(store.getState().ui.notices).toHaveLength(notices);
    });
});

describe('two-way sync', () => {
    const remoteVideo = (playlistId: string, id: string) => ({
        id,
        playlistId,
        youtubeId: 'dQw4w9WgXcQ',
        title: 'From the phone',
        createdAt: 1,
        updatedAt: Date.now() + 1000,
    });

    it('shows what it pulled, keeping the open playlist even if another was remembered', async () => {
        await inChain();
        const first = store.dispatch(createPlaylist({ name: 'First' }))!;
        store.dispatch(selectPlaylist(first.id));
        const second = store.dispatch(createPlaylist({ name: 'Second' }))!;

        incoming = { videos: [remoteVideo(second.id, 'remote-1')] };
        await store.dispatch(syncNow());

        expect(selectSelectedPlaylist(store.getState())?.id).toBe(second.id);
        expect(selectAllVideos(store.getState()).map((v) => v.title)).toEqual(['From the phone']);
        expect(lastNotice()?.message).toBe('Synced. 1 change from the cloud.');
    });

    it('stops the player when a pulled change deletes the video playing', async () => {
        await inChain();
        const { id } = store.dispatch(createPlaylist({ name: 'Mine' }))!;
        store.dispatch(addEntries(id, [{ youtubeId: 'dQw4w9WgXcQ', title: 'Song' }]));
        await store.dispatch(syncNow({ quiet: true }));
        const [video] = selectAllVideos(store.getState());
        store.dispatch(played(video!.id));

        incoming = { videos: [{ ...remoteVideo(id, video!.id), deleted: true }] };
        await store.dispatch(syncNow({ quiet: true }));
        expect(selectPlaying(store.getState())).toBeNull();
    });

    it('keeps failures visible, and clears them when settings change', async () => {
        await inChain();
        const fetchNow = globalThis.fetch;
        globalThis.fetch = (async () => {
            throw new TypeError('Failed to fetch');
        }) as typeof fetch;
        expect(await store.dispatch(syncNow())).toBe(false);
        globalThis.fetch = fetchNow;
        expect(sync()).toMatchObject({ status: 'error', error: "Can't reach the sync server" });

        store.dispatch(saveSyncSettings({ apiUrl: '/api', autoSync: false }));
        expect(sync()).toMatchObject({ status: 'idle', error: null });
    });

    it('sends API calls to the address in the settings', async () => {
        store.dispatch(saveSyncSettings({ apiUrl: 'https://api.example.test/', autoSync: true }));
        await store.dispatch(importFromYouTube('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'));
        expect(calls.at(-1)?.path).toContain('https://api.example.test/playlist?');
    });
});

describe('auto-sync', () => {
    it('counts an edit as pending and pushes it after a quiet moment, without syncing again', async () => {
        await inChain();
        const before = syncCalls().length;
        store.dispatch(createPlaylist({ name: 'Edited here' }));
        expect(sync().pending).toBe(1);

        await vi.waitFor(() => expect(syncCalls()).toHaveLength(before + 1), { timeout: 4000 });
        await vi.waitFor(() => expect(sync().pending).toBe(0));
        await new Promise((resolve) => {
            setTimeout(resolve, 300);
        });
        expect(syncCalls()).toHaveLength(before + 1);
    }, 8000);

    it('syncs on return, unless it synced moments ago, and never on a timer', async () => {
        await inChain();
        const timers = vi.spyOn(globalThis, 'setInterval');
        const stop = store.dispatch(startAutoSync());
        expect(timers).not.toHaveBeenCalled();
        timers.mockRestore();
        await new Promise((resolve) => {
            setTimeout(resolve, 500);
        });

        const before = syncCalls().length;
        store.dispatch(syncFinished({ lastSyncedAt: Date.now(), pending: 0 }));
        document.dispatchEvent(new Event('visibilitychange'));
        await new Promise((resolve) => {
            setTimeout(resolve, 700);
        });
        expect(syncCalls()).toHaveLength(before);

        store.dispatch(syncFinished({ lastSyncedAt: Date.now() - 60_000, pending: 0 }));
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.waitFor(() => expect(syncCalls()).toHaveLength(before + 1), { timeout: 2000 });
        stop();
    }, 8000);

    it('does nothing without a chain, or with auto-sync turned off', async () => {
        store.dispatch(syncRequested(0));
        await inChain();
        store.dispatch(saveSyncSettings({ apiUrl: '/api', autoSync: false }));
        const before = syncCalls().length;
        store.dispatch(syncRequested(0));
        await new Promise((resolve) => {
            setTimeout(resolve, 50);
        });
        expect(syncCalls()).toHaveLength(before);
    });
});
