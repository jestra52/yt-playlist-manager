import { fireEvent, render, screen } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { getDatabase, setDatabase } from '@ytpm/core/db/index';
import { collectChanges, markPushed } from '@ytpm/core/sync/sync.repository';
import { insertVideosAfter, listVideos } from '@ytpm/core/videos/videos.repository';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { selected } from '../playlists/playlists.slice';
import { createPlaylist } from '../playlists/playlists.thunks';
import { selectNextVideo, selectVideoById, selectVideoIdsFor, selectVisibleVideos } from './videos.selectors';
import { filterSet, loaded, played, querySet, sortSet } from './videos.slice';
import { addEntries } from './videos.thunks';

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
            entry('aaaaaaaaaaa', 'Track 10', 'Tatsuro Yamashita'),
            entry('bbbbbbbbbbb', 'Élan'),
            entry('ccccccccccc', 'Track 2', 'Anri'),
            entry('ddddddddddd', 'Zebra', 'Anri'),
            entry('eeeeeeeeeee', 'Apple', 'Ásami'),
        ]),
    );
});

describe('sorting the view', () => {
    it('shows the playlist order by default', () => {
        expect(visible()).toEqual(['1:Track 10', '2:Élan', '3:Track 2', '4:Zebra', '5:Apple']);
    });

    it('sorts by artist, then title, with no artist last and accents beside their letter', () => {
        store.dispatch(sortSet('artist'));
        expect(visible()).toEqual(['3:Track 2', '4:Zebra', '5:Apple', '1:Track 10', '2:Élan']);
    });

    it('sorts by title, with numbers in order and accents beside their letter', () => {
        store.dispatch(sortSet('title'));
        expect(visible()).toEqual(['5:Apple', '2:Élan', '3:Track 2', '1:Track 10', '4:Zebra']);
    });

    it('puts Missing videos first, then the rest in playlist order', () => {
        addMissing('Lost', 'Track 2');
        store.dispatch(sortSet('missing'));
        expect(visible()).toEqual(['4:Lost', '1:Track 10', '2:Élan', '3:Track 2', '5:Zebra', '6:Apple']);
    });

    it('works with the filter and search', () => {
        addMissing('Lost', 'Track 2');
        store.dispatch(sortSet('title'));
        store.dispatch(querySet('track'));
        expect(visible()).toEqual(['3:Track 2', '1:Track 10']);
        store.dispatch(querySet(''));
        store.dispatch(filterSet('missing'));
        expect(visible()).toEqual(['4:Lost']);
    });

    it('leaves the playlist order alone and marks nothing for sync', () => {
        const db = getDatabase();
        markPushed(db, collectChanges(db));
        const before = selectVideoIdsFor(store.getState(), playlistId);
        store.dispatch(sortSet('artist'));
        store.dispatch(sortSet('title'));
        expect(selectVideoIdsFor(store.getState(), playlistId)).toEqual(before);
        expect(collectChanges(db).videos).toEqual([]);
    });

    it('keeps Next in the playlist order', () => {
        store.dispatch(sortSet('title'));
        store.dispatch(played(idOf('Track 10')));
        expect(selectNextVideo(store.getState())?.title).toBe('Élan');
    });

    it('goes back to Default when switching playlists', () => {
        store.dispatch(sortSet('title'));
        store.dispatch(selected(playlistId));
        expect(store.getState().videos.sort).toBe('default');
    });

    it('disables moving in a sorted view', () => {
        render(<App store={store} />);
        fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'title' } });
        for (const button of screen.getAllByRole('button', { name: /^Move (up|down)$/ })) {
            expect(button).toBeDisabled();
        }
        expect(screen.getByRole('button', { name: 'Position 5: move "Apple"' })).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'default' } });
        expect(screen.getByRole('button', { name: 'Position 5: move "Apple"' })).toBeEnabled();
        expect(screen.getAllByRole('button', { name: 'Move up' })[1]).toBeEnabled();
    });
});
