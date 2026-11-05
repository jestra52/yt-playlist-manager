import { fireEvent, render, screen, within } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { selectProgressByPlaylist, selectVideoIdsFor } from '../videos/videos.selectors';
import { addVideosFromText, setWatched } from '../videos/videos.thunks';
import { selectPlaylists, selectSelectedPlaylist } from './playlists.selectors';
import { createPlaylist, loadLibrary, selectPlaylist } from './playlists.thunks';

let SQL: SqlJsStatic;
let store: AppStore;

beforeAll(async () => {
    SQL = await initSqlJs();
});

beforeEach(() => {
    setDatabase(new Database(new SQL.Database()));
    store = createStore({ ui: { sidebarOpen: true } });
});

describe('playlist and video slices', () => {
    it('create a playlist, add videos and mark one watched, all saved in the database', () => {
        const id = store.dispatch(createPlaylist('  City Pop  '))!;
        expect(selectSelectedPlaylist(store.getState())?.name).toBe('City Pop');

        const result = store.dispatch(
            addVideosFromText(id, 'https://youtu.be/dQw4w9WgXcQ 9bZkp7q19f0 https://youtu.be/dQw4w9WgXcQ nope'),
        );
        expect(result).toEqual({ added: 2, skipped: 0, invalid: 1 });
        const [first] = selectVideoIdsFor(store.getState(), id);
        store.dispatch(setWatched(first!, true));
        expect(selectProgressByPlaylist(store.getState())[id]).toEqual({ left: 1, total: 2 });

        const reloaded = createStore();
        reloaded.dispatch(loadLibrary());
        expect(selectPlaylists(reloaded.getState()).map((p) => p.name)).toEqual(['City Pop']);
        expect(selectProgressByPlaylist(reloaded.getState())[id]).toEqual({ left: 1, total: 2 });
    });

    it('ignores an empty name and remembers the selected playlist', () => {
        expect(store.dispatch(createPlaylist('   '))).toBeNull();
        const a = store.dispatch(createPlaylist('A'))!;
        store.dispatch(createPlaylist('B'));
        store.dispatch(selectPlaylist(a));

        const reloaded = createStore();
        reloaded.dispatch(loadLibrary());
        expect(selectSelectedPlaylist(reloaded.getState())?.name).toBe('A');
    });
});

describe('playlist page', () => {
    it('creates a playlist from the sidebar, adds a video and marks it watched', async () => {
        const page = createStore();
        render(<App store={page} />);
        expect(screen.getByRole('heading', { name: 'Start your first playlist' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Show playlists' }));
        fireEvent.click(screen.getByRole('button', { name: 'New playlist' }));
        fireEvent.change(screen.getByLabelText('Playlist name'), { target: { value: 'Road trip' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));
        expect(await screen.findByRole('heading', { name: 'Road trip' })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('YouTube video links'), {
            target: { value: 'https://youtu.be/dQw4w9WgXcQ' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        expect(screen.getByRole('status')).toHaveTextContent('Added 1 video');

        fireEvent.click(screen.getByLabelText('Watched: dQw4w9WgXcQ'));
        expect(screen.getByText('left of 1').textContent).toBe('0 left of 1');
        fireEvent.click(screen.getByRole('button', { name: 'Show playlists' }));
        const sidebar = screen.getByRole('navigation', { name: 'Playlists' });
        expect(within(sidebar).getByRole('button', { name: /Road trip/ })).toHaveTextContent('0/1');
    });
});
