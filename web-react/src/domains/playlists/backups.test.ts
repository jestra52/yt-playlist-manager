import { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import { listBackups } from '@ytpm/core/playlists/backups.repository';
import { setChainAccess } from '@ytpm/core/sync/sync.repository';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, type AppStore } from '../../app/store';
import { loadSync, syncNow } from '../sync/sync.thunks';
import { addEntries } from '../videos/videos.thunks';
import { uploadBackups } from './backups.thunks';
import { createPlaylist, downloadReport, importFromYouTube } from './playlists.thunks';

const LIST_ID = 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';
const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let db: Database;
let store: AppStore;
let uploads: { id: string; reason: string; playlistName: string; videoCount: number; content: string }[];
let online: boolean;

const json = (status: number, body: unknown) => new Response(status === 204 ? null : JSON.stringify(body), { status });

const inChain = () => {
    setChainAccess(db, { chainId: 'chain-1', deviceId: 'device-1', deviceCredential: 'credential' });
    store.dispatch(loadSync());
};

const pending = () => listBackups(db);

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
        const path = String(url);
        if (path.includes('/playlist?')) {
            return json(200, {
                id: LIST_ID,
                title: 'House',
                videos: [{ youtubeId: 'aaaaaaaaaaa', title: 'Lady', author: 'Modjo' }],
            });
        }
        if (!online) throw new TypeError('offline');
        if (path.endsWith('/reports')) {
            uploads.push(JSON.parse(init.body as string));
            return json(204, null);
        }
        if (path.endsWith('/sync')) return json(200, { cursor: 1, hasMore: false, changes: {} });
        return json(200, {});
    }) as typeof fetch;
});

afterAll(() => {
    globalThis.fetch = realFetch;
});

beforeEach(() => {
    uploads = [];
    online = true;
    db = new Database(new SQL.Database());
    setDatabase(db);
    store = createStore();
    store.dispatch(loadSync());
});

describe('backups', () => {
    it('keeps a backup on a device without a chain when a playlist is imported', async () => {
        await store.dispatch(importFromYouTube(LIST_ID));
        expect(pending()).toMatchObject([{ playlistName: 'House', reason: 'added', videoCount: 1 }]);
        expect(uploads).toEqual([]);
    });

    it('uploads it right away in a chain, and forgets it here', async () => {
        inChain();
        await store.dispatch(importFromYouTube(LIST_ID));
        await vi.waitFor(() => expect(uploads).toHaveLength(1));
        expect(uploads[0]).toMatchObject({ reason: 'added', playlistName: 'House', videoCount: 1 });
        expect(JSON.parse(uploads[0]!.content)).toMatchObject({ format: 'yuzu-tapes-report' });
        await vi.waitFor(() => expect(pending()).toEqual([]));
    });

    it('saves one when a report is downloaded, in either format', () => {
        vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
        const { id } = store.dispatch(createPlaylist({ name: 'City Pop' }))!;
        store.dispatch(addEntries(id, [{ youtubeId: 'aaaaaaaaaaa', title: 'One' }]));

        store.dispatch(downloadReport(id, 'txt'));
        store.dispatch(downloadReport(id, 'json'));
        expect(pending().map((row) => row.reason)).toEqual(['download', 'download']);
        vi.unstubAllGlobals();
    });

    it('skips an empty playlist', () => {
        const { id } = store.dispatch(createPlaylist({ name: 'Empty' }))!;
        vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
        store.dispatch(downloadReport(id));
        expect(pending()).toEqual([]);
        vi.unstubAllGlobals();
    });

    it('keeps it while offline, and uploads it after the next sync', async () => {
        inChain();
        online = false;
        await store.dispatch(importFromYouTube(LIST_ID));
        await store.dispatch(uploadBackups());
        expect(pending()).toHaveLength(1);

        online = true;
        await store.dispatch(syncNow({ quiet: true }));
        await vi.waitFor(() => expect(uploads).toHaveLength(1));
        await vi.waitFor(() => expect(pending()).toEqual([]));
    });

    it('uploads backups made before joining a chain', async () => {
        await store.dispatch(importFromYouTube(LIST_ID));
        inChain();
        await store.dispatch(syncNow({ quiet: true }));
        await vi.waitFor(() => expect(uploads).toHaveLength(1));
    });
});
