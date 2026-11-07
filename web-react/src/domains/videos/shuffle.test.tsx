import { fireEvent, render, screen, within } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { getDatabase, setDatabase } from '@ytpm/core/db/index';
import { collectChanges, markPushed } from '@ytpm/core/sync/sync.repository';
import { insertVideosAfter, listVideos } from '@ytpm/core/videos/videos.repository';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { createPlaylist, selectPlaylist } from '../playlists/playlists.thunks';
import {
    selectNextVideo,
    selectPlaying,
    selectPreviousVideo,
    selectShuffleOn,
    selectVideoById,
    selectVideoIdsFor,
} from './videos.selectors';
import { loaded, played, playerClosed } from './videos.slice';
import { addEntries, playNext, playPrevious, removeVideo, toggleShuffle } from './videos.thunks';

const TITLES = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let store: AppStore;
let playlistId: string;

const idOf = (title: string) =>
    store.getState().videos.ids.find((id) => store.getState().videos.entities[id]?.title === title)!;
const playingTitle = () => selectPlaying(store.getState())?.title;
const titles = () =>
    selectVideoIdsFor(store.getState(), playlistId).map((id) => selectVideoById(store.getState(), id)?.title);
const playToTheEnd = () => {
    const seen = [playingTitle()];
    while (selectNextVideo(store.getState())) {
        store.dispatch(playNext());
        seen.push(playingTitle());
    }
    return seen;
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
        addEntries(
            playlistId,
            TITLES.map((title, i) => ({ youtubeId: String(i).repeat(11), title })),
        ),
    );
    store.dispatch(played(idOf('Three')));
});

describe('shuffle', () => {
    it('starts from the playing video and reaches every video once', () => {
        store.dispatch(toggleShuffle());
        expect(selectPreviousVideo(store.getState())).toBeNull();
        const seen = playToTheEnd();
        expect(seen[0]).toBe('Three');
        expect([...seen].sort()).toEqual([...TITLES].sort());
    });

    it('goes back through the same order with Previous', () => {
        store.dispatch(toggleShuffle());
        const seen = playToTheEnd();
        const back = [playingTitle()];
        while (selectPreviousVideo(store.getState())) {
            store.dispatch(playPrevious());
            back.push(playingTitle());
        }
        expect(back).toEqual([...seen].reverse());
    });

    it('skips Missing videos', () => {
        insertVideosAfter(getDatabase(), playlistId, [{ title: 'Lost', youtubeId: '', afterId: idOf('Four') }]);
        store.dispatch(loaded(listVideos(getDatabase())));
        store.dispatch(toggleShuffle());
        expect(playToTheEnd()).not.toContain('Lost');
    });

    it('moves past a video removed while on', () => {
        store.dispatch(toggleShuffle());
        const next = selectNextVideo(store.getState())!;
        store.dispatch(removeVideo(next.id));
        expect([...playToTheEnd()].sort()).toEqual(TITLES.filter((t) => t !== next.title).sort());
    });

    it("doesn't play anything by itself, change the order or sync", () => {
        const db = getDatabase();
        markPushed(db, collectChanges(db));
        store.dispatch(toggleShuffle());
        expect(playingTitle()).toBe('Three');
        expect(titles()).toEqual(TITLES);
        expect(collectChanges(db).videos).toEqual([]);
    });

    it('goes back to the playlist order when turned off', () => {
        store.dispatch(toggleShuffle());
        store.dispatch(toggleShuffle());
        expect(selectShuffleOn(store.getState())).toBe(false);
        expect(selectNextVideo(store.getState())?.title).toBe('Four');
    });

    it('resets when switching playlists, and not when picking the same one', () => {
        const other = store.dispatch(createPlaylist({ name: 'Other' }))!.id;
        store.dispatch(selectPlaylist(playlistId));
        store.dispatch(toggleShuffle());
        store.dispatch(selectPlaylist(playlistId));
        expect(selectShuffleOn(store.getState())).toBe(true);

        store.dispatch(selectPlaylist(other));
        store.dispatch(selectPlaylist(playlistId));
        expect(selectShuffleOn(store.getState())).toBe(false);
    });

    it('stays on after closing the player in the same playlist', () => {
        store.dispatch(toggleShuffle());
        store.dispatch(playerClosed());
        store.dispatch(played(idOf('One')));
        expect(selectShuffleOn(store.getState())).toBe(true);
    });

    it('toggles from the player', () => {
        render(<App store={store} />);
        const player = within(screen.getByRole('region', { name: 'Now playing' }));
        const button = player.getByRole('button', { name: 'Shuffle' });
        expect(button).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(player.getByRole('button', { name: 'Previous' })).toBeDisabled();
    });
});
