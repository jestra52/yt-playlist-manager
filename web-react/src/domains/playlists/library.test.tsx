import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { selectProgressByPlaylist, selectVideoById, selectVideoIdsFor } from '../videos/videos.selectors';
import { addEntries, addVideosFromText, setWatched } from '../videos/videos.thunks';
import { selectPlaylists, selectSelectedPlaylist } from './playlists.selectors';
import { createFromInput, createPlaylist, loadLibrary, selectPlaylist } from './playlists.thunks';

const LIST = 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';
const PLAYLIST = {
    id: LIST,
    title: 'Road trip',
    author: 'Juan',
    skipped: 1,
    partial: false,
    source: 'api',
    videos: [
        { youtubeId: 'dQw4w9WgXcQ', title: 'Anri - Windy Summer', author: 'Label', thumbnailUrl: '' },
        { youtubeId: 'kJQP7kiw5Fk', title: 'Plastic Love', author: 'Mariya Takeuchi - Topic', thumbnailUrl: '' },
    ],
};

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let store: AppStore;

const lastNotice = () => store.getState().ui.notices.at(-1);
const videosOf = (playlistId: string) =>
    selectVideoIdsFor(store.getState(), playlistId).map((id) => selectVideoById(store.getState(), id));

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/playlist?')) {
            return url.includes(LIST)
                ? json(200, PLAYLIST)
                : json(404, { error: 'playlist not found, or it is private' });
        }
        const video = url.match(/oembed\?id=([^&]+)/)?.[1];
        if (video) return json(200, { title: `Kenji Mori - Song ${video}`, author: 'Uploader' });
        return json(503, {});
    }) as typeof fetch;
});

afterAll(() => {
    globalThis.fetch = realFetch;
});

beforeEach(() => {
    setDatabase(new Database(new SQL.Database()));
    store = createStore();
});

describe('switching playlists', () => {
    it('shows only the open playlist, with all its videos', async () => {
        const first = store.dispatch(createPlaylist({ name: 'First' }))!;
        const entries = Array.from({ length: 30 }, (_, i) => ({
            youtubeId: String(i).padStart(11, 'a'),
            title: `Song ${i}`,
        }));
        store.dispatch(addEntries(first.id, entries));
        const second = store.dispatch(createPlaylist({ name: 'Second' }))!;
        render(<App store={store} />);

        act(() => {
            store.dispatch(selectPlaylist(first.id));
        });
        expect(await screen.findAllByRole('checkbox', { name: /^Watched:/ })).toHaveLength(30);

        act(() => {
            store.dispatch(selectPlaylist(second.id));
        });
        await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Playlist name' })).toHaveLength(1));
        expect(screen.getByRole('textbox', { name: 'Playlist name' })).toHaveValue('Second');
    });
});

describe('playlist and video slices', () => {
    it('add videos, mark one watched, and keep it all in the database', async () => {
        const { id } = store.dispatch(createPlaylist({ name: '  City Pop  ' }))!;
        expect(selectSelectedPlaylist(store.getState())?.name).toBe('City Pop');

        const text = 'https://youtu.be/dQw4w9WgXcQ 9bZkp7q19f0 https://youtu.be/dQw4w9WgXcQ nope';
        expect(await store.dispatch(addVideosFromText(id, text))).toBe(true);
        expect(lastNotice()?.message).toBe('Added 2 videos. 1 link skipped');
        const [first] = selectVideoIdsFor(store.getState(), id);
        store.dispatch(setWatched(first!, true));
        expect(selectProgressByPlaylist(store.getState())[id]).toEqual({ left: 1, total: 2 });

        const reloaded = createStore();
        reloaded.dispatch(loadLibrary());
        expect(selectPlaylists(reloaded.getState()).map((p) => p.name)).toEqual(['City Pop']);
        expect(selectProgressByPlaylist(reloaded.getState())[id]).toEqual({ left: 1, total: 2 });
    });

    it('fetches the title and channel from YouTube and guesses the artist', async () => {
        const { id } = store.dispatch(createPlaylist({ name: 'Mix' }))!;
        await store.dispatch(addVideosFromText(id, 'dQw4w9WgXcQ'));
        await waitFor(() => expect(videosOf(id)[0]?.title).toBe('Kenji Mori - Song dQw4w9WgXcQ'));
        expect(videosOf(id)[0]).toMatchObject({ author: 'Uploader', artist: 'Kenji Mori', artistSource: 'guess' });
    });

    it('ignores an empty name and remembers the selected playlist', () => {
        expect(store.dispatch(createPlaylist({ name: '   ' }))).toBeNull();
        const a = store.dispatch(createPlaylist({ name: 'A' }))!;
        store.dispatch(createPlaylist({ name: 'B' }));
        store.dispatch(selectPlaylist(a.id));

        const reloaded = createStore();
        reloaded.dispatch(loadLibrary());
        expect(selectSelectedPlaylist(reloaded.getState())?.name).toBe('A');
    });
});

describe('links', () => {
    const watchLink = `https://www.youtube.com/watch?v=9bZkp7q19f0&list=${LIST}`;

    it('imports a YouTube playlist with its title, source and guessed artists', async () => {
        const playlist = await store.dispatch(createFromInput(`https://www.youtube.com/playlist?list=${LIST}`));
        expect(playlist).toMatchObject({ name: 'Road trip', source: 'youtube', sourceId: LIST });
        expect(videosOf(playlist!.id).map((v) => v?.artist)).toEqual(['Anri', 'Mariya Takeuchi']);
        expect(lastNotice()?.message).toBe('Imported "Road trip" with 2 videos. 1 private or deleted video left out');
    });

    it('reports a playlist YouTube refuses without creating anything', async () => {
        const link = 'https://www.youtube.com/playlist?list=PLprivateprivateprivate';
        expect(await store.dispatch(createFromInput(link))).toBeNull();
        expect(selectPlaylists(store.getState())).toHaveLength(0);
        expect(lastNotice()).toMatchObject({ tone: 'error', message: 'Playlist not found, or it is private' });
    });

    it('imports the playlist of a watch link, or starts with just its video when asked', async () => {
        const imported = await store.dispatch(createFromInput(watchLink));
        expect(imported?.name).toBe('Road trip');
        const single = await store.dispatch(createFromInput(watchLink, { justVideo: true }));
        expect(single?.sourceId).toBe('');
        expect(videosOf(single!.id).map((v) => v?.youtubeId)).toEqual(['9bZkp7q19f0']);
    });

    it('adds just the video of a watch link, or the whole playlist when asked', async () => {
        const { id } = store.dispatch(createPlaylist({ name: 'Choices' }))!;
        await store.dispatch(addVideosFromText(id, watchLink));
        expect(videosOf(id).map((v) => v?.youtubeId)).toEqual(['9bZkp7q19f0']);
        await store.dispatch(addVideosFromText(id, watchLink, { wholePlaylists: true }));
        expect(videosOf(id).map((v) => v?.youtubeId)).toEqual(['9bZkp7q19f0', 'dQw4w9WgXcQ', 'kJQP7kiw5Fk']);
    });

    it('starts a playlist with just the video of a Mix link, and refuses private lists', async () => {
        const mix = await store.dispatch(
            createFromInput('https://www.youtube.com/watch?v=CMZRJb1jxzE&list=RDCMZRJb1jxzE&start_radio=1'),
        );
        expect(mix?.name).toBe('Kenji Mori - Song CMZRJb1jxzE');
        expect(videosOf(mix!.id).map((v) => v?.youtubeId)).toEqual(['CMZRJb1jxzE']);
        expect(lastNotice()?.message).toContain("Mixes can't be imported");

        expect(await store.dispatch(createFromInput('https://www.youtube.com/playlist?list=WL'))).toBeNull();
        expect(selectPlaylists(store.getState())).toHaveLength(1);
        expect(lastNotice()).toMatchObject({ tone: 'error' });
    });
});

describe('playlist page', () => {
    it('creates a playlist from the sidebar, adds a video and marks it watched', async () => {
        render(<App store={store} />);
        expect(screen.getByRole('heading', { name: 'Start your first playlist' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Show playlists' }));
        fireEvent.click(screen.getByRole('button', { name: 'New playlist' }));
        fireEvent.change(screen.getByLabelText('Playlist name or YouTube playlist link'), {
            target: { value: 'Road trip' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));
        expect(await screen.findByRole('textbox', { name: 'Playlist name' })).toHaveValue('Road trip');

        fireEvent.change(screen.getByLabelText('YouTube video or playlist links'), {
            target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        expect(await screen.findByText('Added 1 video')).toBeInTheDocument();

        fireEvent.click(await screen.findByLabelText('Watched: Kenji Mori - Song dQw4w9WgXcQ'));
        expect(screen.getByText('All 1 watched')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Show playlists' }));
        const sidebar = screen.getByRole('navigation', { name: 'Playlists' });
        expect(within(sidebar).getByRole('button', { name: /Road trip/ })).toHaveTextContent('0/1');
    });

    it('offers the video or the whole playlist for a watch link', async () => {
        const { id } = store.dispatch(createPlaylist({ name: 'Choices' }))!;
        render(<App store={store} />);
        const input = screen.getByLabelText('YouTube video or playlist links');
        expect(screen.queryByText('This link is from a playlist:')).not.toBeInTheDocument();

        fireEvent.change(input, { target: { value: `https://www.youtube.com/watch?v=9bZkp7q19f0&list=${LIST}` } });
        fireEvent.click(screen.getByRole('radio', { name: 'Add the whole playlist' }));
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        await waitFor(() => expect(videosOf(id)).toHaveLength(2));
    });
});
