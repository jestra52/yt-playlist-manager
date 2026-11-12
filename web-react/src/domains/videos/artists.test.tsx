import { fireEvent, render, screen, within } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { getDatabase, setDatabase } from '@ytpm/core/db/index';
import { collectChanges, markPushed } from '@ytpm/core/sync/sync.repository';
import { updateVideo } from '@ytpm/core/videos/videos.repository';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { createPlaylist, loadLibrary } from '../playlists/playlists.thunks';
import { selectKnownArtists, selectVideoById, selectVisibleVideos } from './videos.selectors';
import { changed } from './videos.slice';
import { addEntries, addFromReport, saveArtists } from './videos.thunks';

const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let store: AppStore;
let playlistId: string;

const entry = (youtubeId: string, title: string, artist = '') => ({ youtubeId, title, author: 'Channel', artist });
const idOf = (title: string) =>
    store.getState().videos.ids.find((id) => store.getState().videos.entities[id]?.title === title)!;
const video = (title: string) => selectVideoById(store.getState(), idOf(title))!;
const visibleTitles = () =>
    selectVisibleVideos(store.getState(), playlistId).rows.map(
        ({ id }) => selectVideoById(store.getState(), id)?.title,
    );
const reloaded = () => {
    const fresh = createStore();
    fresh.dispatch(loadLibrary());
    return fresh;
};
const rowOf = (title: string) => screen.getByRole('link', { name: title }).closest('li')!;

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
            entry('aaaaaaaaaaa', 'Plastic Love', 'Mariya Takeuchi'),
            entry('bbbbbbbbbbb', 'Windy Summer', 'Anri'),
            entry('ccccccccccc', 'Last Summer Whisper'),
        ]),
    );
});

describe('several artists', () => {
    it('saves main and featured artists in the spelling already in use', () => {
        store.dispatch(
            saveArtists(idOf('Last Summer Whisper'), [
                { name: 'anri', role: 'featured' },
                { name: 'Sumiko Yoshida', role: 'main' },
            ]),
        );
        expect(selectVideoById(reloaded().getState(), idOf('Last Summer Whisper'))).toMatchObject({
            artist: 'Sumiko Yoshida feat. Anri',
            artistSource: 'user',
            artists: [
                { name: 'Sumiko Yoshida', role: 'main' },
                { name: 'Anri', role: 'featured' },
            ],
        });
    });

    it('suggests and searches each artist on their own, featured ones too', () => {
        store.dispatch(
            saveArtists(idOf('Last Summer Whisper'), [
                { name: 'Sumiko Yoshida', role: 'main' },
                { name: 'Anri', role: 'featured' },
            ]),
        );
        expect(selectKnownArtists(store.getState())).toEqual(['Anri', 'Mariya Takeuchi', 'Sumiko Yoshida']);

        render(<App store={store} />);
        fireEvent.click(within(rowOf('Last Summer Whisper')).getByRole('button', { name: 'Anri' }));
        expect(visibleTitles()).toEqual(['Windy Summer', 'Last Summer Whisper']);
    });

    it('adds, reorders and removes artists in the row', () => {
        render(<App store={store} />);
        const row = rowOf('Windy Summer');
        fireEvent.click(within(row).getByRole('button', { name: 'Edit the artists of Windy Summer' }));

        fireEvent.click(within(row).getByRole('button', { name: 'Add featured artist' }));
        fireEvent.change(within(row).getByLabelText('Featured artist 1 of Windy Summer'), {
            target: { value: 'Mariya Takeuchi' },
        });
        fireEvent.click(within(row).getByRole('button', { name: 'Add artist' }));
        fireEvent.change(within(row).getByLabelText('Artist 2 of Windy Summer'), {
            target: { value: 'Tatsuro Yamashita' },
        });
        fireEvent.click(within(row).getByRole('button', { name: 'Move up: Artist 2 of Windy Summer' }));
        fireEvent.click(within(row).getByRole('button', { name: 'Save' }));
        expect(video('Windy Summer').artist).toBe('Tatsuro Yamashita & Anri feat. Mariya Takeuchi');
        expect(row).toHaveTextContent('Tatsuro Yamashita & Anri feat. Mariya Takeuchi');

        fireEvent.click(within(row).getByRole('button', { name: 'Edit the artists of Windy Summer' }));
        fireEvent.click(within(row).getByRole('button', { name: 'Remove: Artist 1 of Windy Summer' }));
        fireEvent.click(within(row).getByRole('button', { name: 'Remove: Artist 1 of Windy Summer' }));
        fireEvent.click(within(row).getByRole('button', { name: 'Save' }));
        expect(video('Windy Summer')).toMatchObject({
            artist: 'Mariya Takeuchi',
            artists: [{ name: 'Mariya Takeuchi', role: 'main' }],
        });
    });

    it('keeps the artists on Cancel or Escape, and leaves an unchanged guess a guess', () => {
        const db = getDatabase();
        const guessed = updateVideo(db, idOf('Windy Summer'), { artist: 'Anri', artistSource: 'guess' })!;
        store.dispatch(changed(guessed));
        markPushed(db, collectChanges(db));
        render(<App store={store} />);
        const row = rowOf('Windy Summer');

        fireEvent.click(within(row).getByRole('button', { name: /^Artist guessed/ }));
        fireEvent.change(within(row).getByLabelText('Artist of Windy Summer'), { target: { value: 'Someone' } });
        fireEvent.click(within(row).getByRole('button', { name: 'Cancel' }));
        expect(video('Windy Summer').artist).toBe('Anri');

        fireEvent.click(within(row).getByRole('button', { name: /^Artist guessed/ }));
        fireEvent.keyDown(within(row).getByLabelText('Artist of Windy Summer'), { key: 'Escape' });
        fireEvent.click(within(row).getByRole('button', { name: /^Artist guessed/ }));
        fireEvent.click(within(row).getByRole('button', { name: 'Save' }));
        expect(video('Windy Summer').artistSource).toBe('guess');
        expect(collectChanges(db).videos).toEqual([]);
    });

    it('guesses several artists from a new video title', () => {
        store.dispatch(
            addEntries(playlistId, [
                { youtubeId: 'ddddddddddd', title: 'Anri × Junko Ohashi - Sunset (feat. Omega Tribe)' },
            ]),
        );
        expect(video('Anri × Junko Ohashi - Sunset (feat. Omega Tribe)')).toMatchObject({
            artist: 'Anri & Junko Ohashi feat. Omega Tribe',
            artistSource: 'guess',
            artists: [
                { name: 'Anri', role: 'main' },
                { name: 'Junko Ohashi', role: 'main' },
                { name: 'Omega Tribe', role: 'featured' },
            ],
        });
    });

    it('splits the artists of a report entry it puts back', () => {
        store.dispatch(
            addFromReport(playlistId, [
                {
                    number: 4,
                    title: 'Midnight Pretenders',
                    youtubeId: '',
                    artist: 'Tomoko Aran feat. Anri',
                    afterId: null,
                },
            ]),
        );
        expect(video('Midnight Pretenders')).toMatchObject({
            artist: 'Tomoko Aran feat. Anri',
            artistSource: 'user',
            artists: [
                { name: 'Tomoko Aran', role: 'main' },
                { name: 'Anri', role: 'featured' },
            ],
        });
    });

    it('puts back the exact artists a JSON report kept', () => {
        const artists = [
            { name: 'Simon & Garfunkel', role: 'main' as const },
            { name: 'Anri', role: 'featured' as const },
        ];
        store.dispatch(
            addFromReport(playlistId, [
                {
                    number: 4,
                    title: 'Kodachrome',
                    youtubeId: '',
                    artist: 'Simon & Garfunkel feat. Anri',
                    artists,
                    afterId: null,
                },
            ]),
        );
        expect(video('Kodachrome')).toMatchObject({ artist: 'Simon & Garfunkel feat. Anri', artists });
    });

    it('keeps names the library knows whole when it splits a report or guesses', () => {
        store.dispatch(saveArtists(idOf('Plastic Love'), [{ name: 'Earth, Wind & Fire', role: 'main' }]));
        store.dispatch(
            addFromReport(playlistId, [
                { number: 4, title: 'September', youtubeId: '', artist: 'Earth, Wind & Fire & Anri', afterId: null },
            ]),
        );
        expect(video('September').artists).toEqual([
            { name: 'Earth, Wind & Fire', role: 'main' },
            { name: 'Anri', role: 'main' },
        ]);

        store.dispatch(
            addEntries(playlistId, [{ youtubeId: 'eeeeeeeeeee', title: 'Earth, Wind & Fire - Boogie Wonderland' }]),
        );
        expect(video('Earth, Wind & Fire - Boogie Wonderland')).toMatchObject({
            artist: 'Earth, Wind & Fire',
            artistSource: 'guess',
        });
    });
});
