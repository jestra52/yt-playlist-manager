import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { createPlaylist, loadLibrary } from '../playlists/playlists.thunks';
import { selectVideoById, selectVideoIdsFor } from './videos.selectors';
import { addEntries, moveToPlaylist, removeVideo, reorder, restoreVideo, saveArtist, saveNotes } from './videos.thunks';

const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let store: AppStore;
let playlistId: string;

const entry = (youtubeId: string, title: string, artist = '') => ({ youtubeId, title, author: 'Channel', artist });
const titles = (id = playlistId) =>
    selectVideoIdsFor(store.getState(), id).map((v) => selectVideoById(store.getState(), v)?.title);
const idOf = (title: string) =>
    store.getState().videos.ids.find((id) => store.getState().videos.entities[id]?.title === title)!;
const reloaded = () => {
    const fresh = createStore();
    fresh.dispatch(loadLibrary());
    return fresh;
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

describe('video actions', () => {
    it('reorders a video and keeps the order after a reload', () => {
        store.dispatch(reorder(idOf('Three'), 0));
        expect(titles()).toEqual(['Three', 'One', 'Two']);
        store = reloaded();
        expect(titles()).toEqual(['Three', 'One', 'Two']);
    });

    it('moves a video to another playlist, and refuses a duplicate', () => {
        const other = store.dispatch(createPlaylist({ name: 'Other' }))!;
        store.dispatch(addEntries(other.id, [entry('bbbbbbbbbbb', 'Two again')]));

        store.dispatch(moveToPlaylist(idOf('One'), other));
        expect(titles()).toEqual(['Two', 'Three']);
        expect(titles(other.id)).toEqual(['Two again', 'One']);
        expect(store.getState().ui.notices.at(-1)?.message).toBe('Moved to "Other"');

        store.dispatch(moveToPlaylist(idOf('Two'), other));
        expect(titles()).toEqual(['Two', 'Three']);
        expect(store.getState().ui.notices.at(-1)).toMatchObject({ tone: 'error' });
    });

    it('removes a video and restores it', () => {
        const id = idOf('Two');
        store.dispatch(removeVideo(id));
        expect(titles()).toEqual(['One', 'Three']);
        expect(store.getState().ui.notices.at(-1)).toMatchObject({ message: 'Removed "Two"', undoVideoId: id });
        store.dispatch(restoreVideo(id));
        expect(titles()).toEqual(['One', 'Two', 'Three']);
    });

    it('saves notes, and an artist by hand in the spelling already in use', () => {
        const id = idOf('Two');
        store.dispatch(saveNotes(id, 'Great intro'));
        store.dispatch(saveArtist(id, 'tomoko aran'));
        expect(selectVideoById(reloaded().getState(), id)).toMatchObject({
            notes: 'Great intro',
            artist: 'Tomoko Aran',
            artistSource: 'user',
        });
    });
});

describe('video row', () => {
    it('moves a video down, and disables moving past the ends', () => {
        render(<App store={store} />);
        const [firstUp] = screen.getAllByRole('button', { name: 'Move up' });
        const downs = screen.getAllByRole('button', { name: 'Move down' });
        expect(firstUp).toBeDisabled();
        expect(downs.at(-1)).toBeDisabled();

        fireEvent.click(downs[0]!);
        expect(titles()).toEqual(['Two', 'One', 'Three']);
    });

    it('removes a video and brings it back with Undo', async () => {
        render(<App store={store} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Remove from playlist' })[0]!);
        expect(titles()).toEqual(['Two', 'Three']);

        fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
        await waitFor(() => expect(titles()).toEqual(['One', 'Two', 'Three']));
    });

    it('edits notes and the artist in the row', () => {
        render(<App store={store} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Edit notes' })[1]!);
        const notes = screen.getByLabelText('Notes for Two');
        fireEvent.change(notes, { target: { value: 'At 1:20' } });
        fireEvent.blur(notes);
        expect(screen.getByRole('button', { name: 'At 1:20' })).toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('button', { name: 'Add artist' })[0]!);
        const artist = screen.getByLabelText('Artist of Two');
        fireEvent.change(artist, { target: { value: 'Anri' } });
        fireEvent.keyDown(artist, { key: 'Enter' });
        expect(screen.getByRole('button', { name: 'Anri' })).toBeInTheDocument();
    });
});
