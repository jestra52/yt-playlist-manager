import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { selectAllVideos, selectPlaying } from '../videos/videos.selectors';
import { played } from '../videos/videos.slice';
import { addEntries } from '../videos/videos.thunks';
import { selectSelectedPlaylist } from './playlists.selectors';
import { createPlaylist, linkToYouTube } from './playlists.thunks';

const LIST = 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';
const youtube = (overrides = {}) => ({
    id: LIST,
    title: 'Road trip',
    author: 'Juan',
    skipped: 0,
    partial: false,
    source: 'api',
    videos: [
        { youtubeId: 'aaaaaaaaaaa', title: 'One', author: 'A', thumbnailUrl: '' },
        { youtubeId: 'bbbbbbbbbbb', title: 'Deleted video', author: '', thumbnailUrl: '', unavailable: true },
        { youtubeId: 'ddddddddddd', title: 'Anri - New one', author: 'Label', thumbnailUrl: '' },
    ],
    ...overrides,
});

const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let store: AppStore;
let playlistId: string;
let reply: () => Response;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const videos = () => selectAllVideos(store.getState()).filter((v) => v.playlistId === playlistId);
const open = () => {
    render(<App store={store} />);
    fireEvent.click(screen.getByRole('button', { name: /YouTube playlist: sync from it/ }));
};
const compared = async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Compare with YouTube' }));
    await screen.findByText('New on YouTube');
};

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = (async (input: RequestInfo | URL) =>
        String(input).includes('/playlist?') ? reply() : json(503, {})) as typeof fetch;
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:report', revokeObjectURL: () => {} }));
});

afterAll(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllGlobals();
});

beforeEach(() => {
    setDatabase(new Database(new SQL.Database()));
    store = createStore();
    reply = () => json(200, youtube());
    playlistId = store.dispatch(createPlaylist({ name: 'City Pop', source: 'youtube', sourceId: LIST }))!.id;
    store.dispatch(
        addEntries(playlistId, [
            { youtubeId: 'aaaaaaaaaaa', title: 'One' },
            { youtubeId: 'bbbbbbbbbbb', title: 'Two' },
            { youtubeId: 'ccccccccccc', title: 'Three' },
        ]),
    );
});

describe('linking', () => {
    it('links with a playlist link, unlinks, and refuses a Mix', () => {
        const { id } = store.dispatch(createPlaylist({ name: 'Plain' }))!;
        expect(store.dispatch(linkToYouTube(id, `https://www.youtube.com/playlist?list=${LIST}`))).toBe(true);
        expect(selectSelectedPlaylist(store.getState())).toMatchObject({ source: 'youtube', sourceId: LIST });

        expect(
            store.dispatch(linkToYouTube(id, 'https://www.youtube.com/watch?v=CMZRJb1jxzE&list=RDCMZRJb1jxzE')),
        ).toBe(false);
        expect(store.getState().ui.notices.at(-1)?.message).toContain('YouTube Mix');

        expect(store.dispatch(linkToYouTube(id, ''))).toBe(true);
        expect(selectSelectedPlaylist(store.getState())).toMatchObject({ source: '', sourceId: '' });
    });

    it('stays open after linking from the dialog', async () => {
        const { id } = store.dispatch(createPlaylist({ name: 'Plain' }))!;
        render(<App store={store} />);
        fireEvent.click(screen.getByRole('button', { name: 'Link to a YouTube playlist and sync from it' }));
        fireEvent.change(screen.getByLabelText('YouTube playlist link or ID'), { target: { value: LIST } });
        fireEvent.click(screen.getByRole('button', { name: 'Link' }));

        expect(await screen.findByRole('button', { name: 'Compare with YouTube' })).toBeInTheDocument();
        expect(store.getState().playlists.entities[id]?.sourceId).toBe(LIST);
    });
});

describe('sync dialog', () => {
    it('shows the differences and changes nothing until applied', async () => {
        await compared();
        expect(screen.getByText('Anri - New one')).toBeInTheDocument();
        expect(screen.getByText('Removed from the YouTube playlist')).toBeInTheDocument();
        expect(videos()).toHaveLength(3);
    });

    it('adds new videos, marks deleted ones and keeps removed ones by default', async () => {
        await compared();
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(videos()).toHaveLength(4));
        expect(videos().map((v) => v.youtubeId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ddddddddddd', 'ccccccccccc']);
        expect(videos().find((v) => v.youtubeId === 'bbbbbbbbbbb')).toMatchObject({ unavailable: true, title: 'Two' });
        expect(videos().find((v) => v.youtubeId === 'ddddddddddd')).toMatchObject({ artist: 'Anri' });
        expect(store.getState().ui.notices.at(-1)?.message).toBe(
            'Synced with YouTube: 1 new video added, 1 marked as deleted on YouTube',
        );
    });

    it('asks for a second click before removing, and stops the player on a removed video', async () => {
        store.dispatch(played(videos().find((v) => v.youtubeId === 'ccccccccccc')!.id));
        await compared();
        fireEvent.click(screen.getByRole('checkbox', { name: /Remove the 1 video removed on YouTube/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        expect(screen.getByRole('alert')).toHaveTextContent('This removes 1 video from this playlist');
        expect(videos()).toHaveLength(3);

        fireEvent.click(screen.getByRole('button', { name: 'Remove 1 video and apply' }));
        await waitFor(() => expect(videos().some((v) => v.youtubeId === 'ccccccccccc')).toBe(false));
        expect(selectPlaying(store.getState())).toBeNull();
    });

    it('reads YouTube fresh each time, so a video just added shows up', async () => {
        const fetched = vi.spyOn(globalThis, 'fetch');
        await compared();
        expect(fetched).toHaveBeenCalledWith(
            expect.stringContaining('/playlist?'),
            expect.objectContaining({ cache: 'no-store' }),
        );
        fetched.mockRestore();
    });

    it('leaves nothing to open in an empty section', async () => {
        reply = () => json(200, youtube({ videos: [] }));
        await compared();
        const section = screen.getByText('Deleted or private on YouTube');
        expect(section.closest('details')).toBeNull();
        expect(
            screen.queryByText('Kept, and marked as Missing so you can paste another link.'),
        ).not.toBeInTheDocument();
    });

    it('closes with the X button', async () => {
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('opens fresh after closing', async () => {
        await compared();
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(document.querySelector('dialog')).not.toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /YouTube playlist: sync from it/ }));
        expect(screen.getByRole('button', { name: 'Compare with YouTube' })).toBeInTheDocument();
    });

    it('warns when YouTube only returned part of the playlist, and hides removals', async () => {
        reply = () => json(200, youtube({ partial: true, source: 'feed' }));
        await compared();
        expect(screen.getByText(/only returned part of this playlist/)).toBeInTheDocument();
        expect(screen.queryByText('Removed from the YouTube playlist')).not.toBeInTheDocument();
    });

    it('says when YouTube can not be read', async () => {
        reply = () => json(404, { error: 'playlist not found, or it is private' });
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Compare with YouTube' }));
        expect(await screen.findByText("Couldn't read the YouTube playlist. Try again.")).toBeInTheDocument();
        expect(store.getState().ui.notices.at(-1)).toMatchObject({ tone: 'error' });
    });
});
