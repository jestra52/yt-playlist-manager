import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { selectAllVideos, selectFilter } from '../videos/videos.selectors';
import { addEntries } from '../videos/videos.thunks';
import { addMissingFromReport, createPlaylist, downloadReport } from './playlists.thunks';

const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let store: AppStore;
let playlistId: string;

const REPORT = [
    'Total videos: 3',
    'Format: number: title | artist',
    '1: One | Tomoko Aran',
    '2: Lost song | Anri',
    '3: Two |',
].join('\n');

const titles = () =>
    selectAllVideos(store.getState())
        .filter((v) => v.playlistId === playlistId)
        .map((v) => v.title);

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
});

afterAll(() => {
    globalThis.fetch = realFetch;
});

beforeEach(() => {
    setDatabase(new Database(new SQL.Database()));
    store = createStore();
    playlistId = store.dispatch(createPlaylist({ name: 'City Pop' }))!.id;
    store.dispatch(
        addEntries(playlistId, [
            { youtubeId: 'aaaaaaaaaaa', title: 'One', artist: 'Tomoko Aran' },
            { youtubeId: 'bbbbbbbbbbb', title: 'Two' },
        ]),
    );
});

describe('reports', () => {
    it('saves a report with the videos in order', async () => {
        const created: Blob[] = [];
        const createObjectURL = vi.fn((blob: Blob) => {
            created.push(blob);
            return 'blob:report';
        });
        vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));

        store.dispatch(downloadReport(playlistId));

        const text = await created[0]!.text();
        expect(text).toContain('Total videos: 2');
        expect(text).toContain('1: One | Tomoko Aran');
        expect(store.getState().ui.notices.at(-1)?.message).toMatch(/^Saved city-pop-report-.*\.txt$/);
        vi.unstubAllGlobals();
    });

    it('puts a missing entry back in its old place and opens the Missing filter', () => {
        const one = selectAllVideos(store.getState()).find((v) => v.title === 'One')!;
        store.dispatch(
            addMissingFromReport(playlistId, [
                { number: 2, title: 'Lost song', artist: 'Anri', youtubeId: null, afterId: one.id },
            ]),
        );
        expect(titles()).toEqual(['One', 'Lost song', 'Two']);
        expect(selectAllVideos(store.getState()).find((v) => v.title === 'Lost song')).toMatchObject({
            missing: true,
            artist: 'Anri',
            artistSource: 'user',
        });
        expect(store.getState().ui.notices.at(-1)?.message).toBe('Added 1 missing item. 1 needs a YouTube link');
        expect(selectFilter(store.getState())).toBe('missing');
    });
});

describe('compare dialog', () => {
    const open = () => {
        render(<App store={store} />);
        fireEvent.click(screen.getByRole('button', { name: /Compare with an old report/ }));
    };

    it('shows what a report has that the playlist lost, and adds it back', async () => {
        open();
        fireEvent.change(screen.getByLabelText('Report text'), { target: { value: REPORT } });
        expect(screen.getByText('Report with artists')).toBeInTheDocument();
        const list = screen.getByRole('list', { name: 'Missing items' });
        expect(within(list).getByText(/Lost song/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Add 1 missing item' }));
        await waitFor(() => expect(titles()).toEqual(['One', 'Lost song', 'Two']));
    });

    it('says when a report has no numbered lines, and when nothing is missing', () => {
        open();
        const text = screen.getByLabelText('Report text');
        fireEvent.change(text, { target: { value: 'not a report' } });
        expect(screen.getByRole('alert')).toHaveTextContent('No numbered lines found');

        fireEvent.change(text, { target: { value: '1: One | Tomoko Aran\nFormat: number: title | artist' } });
        expect(screen.getByText(/Nothing is missing/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add missing items' })).toBeDisabled();
    });
});
