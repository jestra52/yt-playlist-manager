import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import { setChainAccess } from '@ytpm/core/sync/sync.repository';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { loadSync } from '../sync/sync.thunks';
import { selectAllVideos } from '../videos/videos.selectors';
import { addEntries } from '../videos/videos.thunks';
import { saveBackup } from './backups.thunks';
import { createPlaylist } from './playlists.thunks';

const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let db: Database;
let store: AppStore;
let playlistId: string;
let serverDown: boolean;

const REPORT = {
    format: 'yuzu-tapes-report',
    version: 1,
    videos: [
        { youtubeId: 'aaaaaaaaaaa', title: 'One' },
        { youtubeId: 'ccccccccccc', title: 'Lost song', notes: 'Keep this' },
    ],
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const open = () => {
    render(<App store={store} />);
    fireEvent.click(screen.getByRole('button', { name: /Compare with an old report/ }));
    return within(screen.getByRole('dialog'));
};

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = (async (url: string) => {
        const path = String(url);
        if (path.includes('/reports') && serverDown) throw new TypeError('down');
        if (path.includes('/reports?')) {
            return json([
                { id: 'r1', playlistId, playlistName: 'City Pop', reason: 'added', videoCount: 2, createdAt: 1000 },
            ]);
        }
        if (path.endsWith('/reports/r1')) return json(REPORT);
        return new Response('{}', { status: 503 });
    }) as typeof fetch;
});

afterAll(() => {
    globalThis.fetch = realFetch;
});

beforeEach(() => {
    serverDown = false;
    db = new Database(new SQL.Database());
    setDatabase(db);
    store = createStore({ ui: { sidebarOpen: true } });
    playlistId = store.dispatch(createPlaylist({ name: 'City Pop' }))!.id;
    store.dispatch(addEntries(playlistId, [{ youtubeId: 'aaaaaaaaaaa', title: 'One' }]));
});

const inChain = () => {
    setChainAccess(db, { chainId: 'chain-1', deviceId: 'device-1', deviceCredential: 'credential' });
    store.dispatch(loadSync());
};

describe('the list of backups', () => {
    it('says when there are none', async () => {
        const dialog = open();
        expect(await dialog.findByText('No backups of this playlist yet.')).toBeInTheDocument();
    });

    it('lists a backup kept on this device, and compares with it', async () => {
        store.dispatch(saveBackup({ id: playlistId, name: 'City Pop' }, 'download'));
        const dialog = open();
        expect(await dialog.findByText(/Report downloaded · 1 video/)).toBeInTheDocument();
        fireEvent.click(dialog.getByRole('button', { name: /^Compare with the backup/ }));
        expect(await dialog.findByText('JSON report, with links and notes')).toBeInTheDocument();
    });

    it('restores a video from a backup on the server', async () => {
        inChain();
        const dialog = open();
        expect(await dialog.findByText(/When added · 2 videos/)).toBeInTheDocument();
        fireEvent.click(dialog.getByRole('button', { name: /^Compare with the backup/ }));
        fireEvent.click(await dialog.findByRole('button', { name: 'Add 1 missing item' }));
        await waitFor(() =>
            expect(selectAllVideos(store.getState()).find((v) => v.youtubeId === 'ccccccccccc')).toMatchObject({
                title: 'Lost song',
                notes: 'Keep this',
            }),
        );
    });

    it('downloads a backup without making another one', async () => {
        const created: Blob[] = [];
        const createObjectURL = vi.fn((blob: Blob) => {
            created.push(blob);
            return 'blob:backup';
        });
        vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
        inChain();
        const dialog = open();
        fireEvent.click(await dialog.findByRole('button', { name: /^Download the backup/ }));
        await waitFor(() => expect(created).toHaveLength(1));
        expect(JSON.parse(await created[0]!.text())).toEqual(REPORT);
        vi.unstubAllGlobals();
    });

    it("lists this device's backups when the server can't be reached", async () => {
        store.dispatch(saveBackup({ id: playlistId, name: 'City Pop' }, 'download'));
        serverDown = true;
        inChain();
        const dialog = open();
        expect(await dialog.findByText(/only this device's backups/)).toBeInTheDocument();
        expect(dialog.getByText(/Report downloaded/)).toBeInTheDocument();
    });
});
