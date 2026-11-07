import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { getDatabase, setDatabase } from '@ytpm/core/db/index';
import { getVideo, insertVideosAfter, listVideos, updateVideo } from '@ytpm/core/videos/videos.repository';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { createPlaylist } from '../playlists/playlists.thunks';
import {
    selectNextVideo,
    selectPlaying,
    selectPreviousVideo,
    selectVideoById,
    selectVisibleVideos,
} from './videos.selectors';
import { filterSet, loaded, played, querySet } from './videos.slice';
import { addEntries, playNext, playPrevious, removeVideo, saveNotes } from './videos.thunks';

const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let store: AppStore;
let playlistId: string;

const entry = (youtubeId: string, title: string, artist = '') => ({ youtubeId, title, author: 'Channel', artist });
const visible = () =>
    selectVisibleVideos(store.getState(), playlistId).rows.map(
        ({ id, index }) => `${index + 1}:${selectVideoById(store.getState(), id)?.title}`,
    );
const idOf = (title: string) =>
    store.getState().videos.ids.find((id) => store.getState().videos.entities[id]?.title === title)!;
const addMissing = (title: string, afterTitle: string) => {
    insertVideosAfter(getDatabase(), playlistId, [{ title, youtubeId: '', afterId: idOf(afterTitle) }]);
    store.dispatch(loaded(listVideos(getDatabase())));
};

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
            entry('aaaaaaaaaaa', 'One', 'Tomoko Aran'),
            entry('bbbbbbbbbbb', 'Two'),
            entry('ccccccccccc', 'Three'),
        ]),
    );
});

describe('filters and search', () => {
    it('filters by Missing and keeps each video in its real place', () => {
        addMissing('Lost', 'Two');
        store.dispatch(filterSet('missing'));
        expect(visible()).toEqual(['3:Lost']);
        store.dispatch(filterSet('all'));
        expect(visible()).toEqual(['1:One', '2:Two', '3:Lost', '4:Three']);
    });

    it('searches titles, artists, channels and notes', () => {
        store.dispatch(saveNotes(idOf('Three'), 'Great intro'));
        store.dispatch(querySet('  ARAN '));
        expect(visible()).toEqual(['1:One']);
        store.dispatch(querySet('intro'));
        expect(visible()).toEqual(['3:Three']);
        store.dispatch(querySet('channel'));
        expect(visible()).toHaveLength(3);
    });
});

describe('player', () => {
    it('plays the next video in the playlist order', () => {
        store.dispatch(played(idOf('One')));
        store.dispatch(playNext());
        expect(selectPlaying(store.getState())?.title).toBe('Two');
    });

    it('skips Missing videos', () => {
        addMissing('Lost', 'One');
        store.dispatch(played(idOf('One')));
        store.dispatch(playNext());
        expect(selectPlaying(store.getState())?.title).toBe('Two');
    });

    it('plays the previous video, skipping Missing videos', () => {
        addMissing('Lost', 'One');
        store.dispatch(played(idOf('Two')));
        store.dispatch(playPrevious());
        expect(selectPlaying(store.getState())?.title).toBe('One');
    });

    it('stays on the last video, without wrapping around', () => {
        store.dispatch(played(idOf('Three')));
        expect(selectNextVideo(store.getState())).toBeNull();
        store.dispatch(playNext());
        expect(selectPlaying(store.getState())?.title).toBe('Three');
    });

    it('stays on the first video, without wrapping around', () => {
        store.dispatch(played(idOf('One')));
        expect(selectPreviousVideo(store.getState())).toBeNull();
        store.dispatch(playPrevious());
        expect(selectPlaying(store.getState())?.title).toBe('One');
    });

    it("stays in the playing video's playlist", () => {
        const other = store.dispatch(createPlaylist({ name: 'Other' }))!.id;
        store.dispatch(addEntries(other, [entry('ddddddddddd', 'Elsewhere')]));
        store.dispatch(played(idOf('Three')));
        expect(selectNextVideo(store.getState())).toBeNull();
    });

    it('stops at the end when only Missing videos follow', () => {
        addMissing('Lost', 'Three');
        store.dispatch(played(idOf('Three')));
        store.dispatch(playNext());
        expect(selectPlaying(store.getState())?.title).toBe('Three');
    });

    it('leaves a stored watched mark alone', () => {
        updateVideo(getDatabase(), idOf('One'), { watched: true });
        store.dispatch(played(idOf('One')));
        store.dispatch(playNext());
        store.dispatch(saveNotes(idOf('One'), 'Still here'));
        expect(getVideo(getDatabase(), idOf('One'))).toMatchObject({ watched: true, notes: 'Still here' });
        expect(getVideo(getDatabase(), idOf('Two'))?.watched).toBe(false);
    });

    it('stops when the playing video is removed', () => {
        store.dispatch(played(idOf('Two')));
        store.dispatch(removeVideo(idOf('Two')));
        expect(selectPlaying(store.getState())).toBeNull();
    });
});

describe('playlist page', () => {
    it('plays from the thumbnail and closes the player', () => {
        render(<App store={store} />);
        fireEvent.click(screen.getByRole('button', { name: 'Play Two' }));
        const player = screen.getByRole('region', { name: 'Now playing' });
        expect(within(player).getByTitle('Two')).toHaveAttribute(
            'src',
            expect.stringContaining('youtube-nocookie.com/embed/bbbbbbbbbbb'),
        );
        fireEvent.click(within(player).getByRole('button', { name: 'Close player' }));
        expect(screen.queryByRole('region', { name: 'Now playing' })).not.toBeInTheDocument();
    });

    it('moves with Previous and Next, which are disabled at the ends', () => {
        render(<App store={store} />);
        fireEvent.click(screen.getByRole('button', { name: 'Play One' }));
        const player = within(screen.getByRole('region', { name: 'Now playing' }));
        expect(player.getByRole('button', { name: 'Previous' })).toBeDisabled();

        fireEvent.click(player.getByRole('button', { name: 'Next' }));
        expect(player.getByTitle('Two')).toBeInTheDocument();
        fireEvent.click(player.getByRole('button', { name: 'Next' }));
        expect(player.getByTitle('Three')).toBeInTheDocument();
        expect(player.getByRole('button', { name: 'Next' })).toBeDisabled();

        fireEvent.click(player.getByRole('button', { name: 'Previous' }));
        expect(player.getByTitle('Two')).toBeInTheDocument();
    });

    it('shows the tabs only when the playlist has Missing videos', () => {
        render(<App store={store} />);
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

        act(() => addMissing('Lost', 'One'));
        fireEvent.click(screen.getByRole('tab', { name: 'Missing (1)' }));
        expect(screen.queryByRole('button', { name: 'Play One' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: 'All' }));
        expect(screen.getByRole('button', { name: 'Play One' })).toBeInTheDocument();
    });

    it('offers a way back when nothing matches', () => {
        render(<App store={store} />);
        fireEvent.change(screen.getByLabelText('Search this playlist'), { target: { value: 'nope' } });
        expect(screen.getByText('Nothing matches "nope".')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
        expect(screen.getByRole('button', { name: 'Play Three' })).toBeInTheDocument();
    });
});
