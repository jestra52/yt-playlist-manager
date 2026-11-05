import { fireEvent, render, screen, within } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { createPlaylist } from '../playlists/playlists.thunks';
import { selectPlaying, selectVideoById, selectVisibleVideos } from './videos.selectors';
import { filterSet, played, querySet } from './videos.slice';
import { addEntries, finishAndPlayNext, removeVideo, saveNotes, setWatched } from './videos.thunks';

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
    it('filters by watched and keeps each video in its real place', () => {
        store.dispatch(setWatched(idOf('Two'), true));
        store.dispatch(filterSet('watched'));
        expect(visible()).toEqual(['2:Two']);
        store.dispatch(filterSet('unwatched'));
        expect(visible()).toEqual(['1:One', '3:Three']);
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
    it('plays the next unwatched video, skipping watched ones, and wraps around', () => {
        store.dispatch(setWatched(idOf('Two'), true));
        store.dispatch(played(idOf('One')));
        store.dispatch(finishAndPlayNext());
        expect(selectPlaying(store.getState())?.title).toBe('Three');
        expect(selectVideoById(store.getState(), idOf('One'))?.watched).toBe(true);
    });

    it('closes when everything is watched', () => {
        store.dispatch(setWatched(idOf('One'), true));
        store.dispatch(setWatched(idOf('Two'), true));
        store.dispatch(played(idOf('Three')));
        store.dispatch(finishAndPlayNext());
        expect(selectPlaying(store.getState())).toBeNull();
        expect(store.getState().ui.notices.at(-1)?.message).toBe("You've watched everything in this playlist");
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

    it('filters with the tabs and offers a way back when nothing matches', () => {
        render(<App store={store} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Watched' }));
        expect(screen.getByText('Nothing watched yet.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Show all videos' }));
        expect(screen.getByRole('button', { name: 'Play One' })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Search this playlist'), { target: { value: 'nope' } });
        expect(screen.getByText('Nothing matches "nope".')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
        expect(screen.getByRole('button', { name: 'Play Three' })).toBeInTheDocument();
    });
});
