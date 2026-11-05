import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { getDatabase, setDatabase } from '@ytpm/core/db/index';
import { insertVideosAfter } from '@ytpm/core/videos/videos.repository';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { selectSelectedPlaylist } from './playlists.selectors';
import { createPlaylist, deletePlaylist, describePlaylist, loadLibrary, renamePlaylist } from './playlists.thunks';
import { selectAllVideos, selectPlaying } from '../videos/videos.selectors';
import { played } from '../videos/videos.slice';
import { addEntries, completeVideo } from '../videos/videos.thunks';
const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let store: AppStore;

const reloaded = () => {
    const fresh = createStore();
    fresh.dispatch(loadLibrary());
    return fresh;
};

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const video = String(input).match(/oembed\?id=([^&]+)/)?.[1];
        return video
            ? new Response(JSON.stringify({ title: `Anri - Song ${video}`, author: 'Label' }), { status: 200 })
            : new Response('{}', { status: 503 });
    }) as typeof fetch;
});

afterAll(() => {
    globalThis.fetch = realFetch;
});

beforeEach(() => {
    setDatabase(new Database(new SQL.Database()));
    store = createStore();
});

describe('playlist header', () => {
    it('renames and describes a playlist, and refuses an empty name', () => {
        const { id } = store.dispatch(createPlaylist({ name: 'City Pop' }))!;
        store.dispatch(renamePlaylist(id, ' Late night '));
        store.dispatch(describePlaylist(id, 'For driving'));
        expect(selectSelectedPlaylist(reloaded().getState())).toMatchObject({
            name: 'Late night',
            description: 'For driving',
        });

        store.dispatch(renamePlaylist(id, '   '));
        expect(selectSelectedPlaylist(store.getState())?.name).toBe('Late night');
        expect(store.getState().ui.notices.at(-1)).toMatchObject({ tone: 'error' });
    });

    it('deletes a playlist with its videos, opens the next one and stops the player', () => {
        const a = store.dispatch(createPlaylist({ name: 'A' }))!;
        const b = store.dispatch(createPlaylist({ name: 'B' }))!;
        store.dispatch(addEntries(a.id, [{ youtubeId: 'aaaaaaaaaaa', title: 'One' }]));
        store.dispatch(played(selectAllVideos(store.getState())[0]!.id));

        store.dispatch(deletePlaylist(a.id));
        expect(selectSelectedPlaylist(store.getState())?.id).toBe(b.id);
        expect(selectAllVideos(store.getState())).toHaveLength(0);
        expect(selectPlaying(store.getState())).toBeNull();
        expect(store.getState().ui.notices.at(-1)?.message).toBe('Deleted "A"');
        expect(selectAllVideos(reloaded().getState())).toHaveLength(0);
    });

    it('asks to confirm before deleting from the page', () => {
        store.dispatch(createPlaylist({ name: 'A' }));
        render(<App store={store} />);
        expect(screen.getByLabelText('Playlist name')).toHaveValue('A');

        fireEvent.click(screen.getByRole('button', { name: 'Delete playlist' }));
        expect(selectSelectedPlaylist(store.getState())?.name).toBe('A');
        fireEvent.click(screen.getByRole('button', { name: 'Confirm deleting this playlist' }));
        expect(selectSelectedPlaylist(store.getState())).toBeNull();
    });

    it('saves a new name when leaving the field', () => {
        store.dispatch(createPlaylist({ name: 'A' }));
        render(<App store={store} />);
        const name = screen.getByLabelText('Playlist name');
        fireEvent.change(name, { target: { value: 'Renamed' } });
        fireEvent.blur(name);
        expect(selectSelectedPlaylist(store.getState())?.name).toBe('Renamed');
    });
});

describe('missing items', () => {
    const withPlaceholder = () => {
        const { id } = store.dispatch(createPlaylist({ name: 'City Pop' }))!;
        store.dispatch(addEntries(id, [{ youtubeId: 'aaaaaaaaaaa', title: 'One' }]));
        insertVideosAfter(getDatabase(), id, [{ title: 'Lost song', youtubeId: '' }]);
        store.dispatch(loadLibrary());
        return selectAllVideos(store.getState()).find((v) => v.missing)!;
    };

    it('completes a placeholder with a link, and gets its details from YouTube', async () => {
        const video = withPlaceholder();
        expect(await store.dispatch(completeVideo(video.id, 'https://youtu.be/bbbbbbbbbbb'))).toBe(true);
        expect(store.getState().videos.entities[video.id]).toMatchObject({
            youtubeId: 'bbbbbbbbbbb',
            missing: false,
            title: 'Anri - Song bbbbbbbbbbb',
            artist: 'Anri',
        });
    });

    it('refuses a bad link and a video already in the playlist', async () => {
        const video = withPlaceholder();
        expect(await store.dispatch(completeVideo(video.id, 'nope'))).toBe(false);
        expect(await store.dispatch(completeVideo(video.id, 'aaaaaaaaaaa'))).toBe(false);
        expect(store.getState().ui.notices.at(-1)?.message).toBe('That video is already in this playlist: "One"');
        expect(store.getState().videos.entities[video.id]?.missing).toBe(true);
    });

    it('shows the Missing filter and a link form in the row, not a player', async () => {
        const video = withPlaceholder();
        render(<App store={store} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Missing (1)' }));
        expect(screen.queryByRole('button', { name: 'Play Lost song' })).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('YouTube link for Lost song'), {
            target: { value: 'https://youtu.be/bbbbbbbbbbb' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(store.getState().videos.entities[video.id]?.missing).toBe(false));
    });
});
