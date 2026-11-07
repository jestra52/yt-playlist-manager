import { fireEvent, render, screen } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { getDatabase, setDatabase } from '@ytpm/core/db/index';
import { collectChanges, markPushed } from '@ytpm/core/sync/sync.repository';
import { insertVideosAfter, listVideos } from '@ytpm/core/videos/videos.repository';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { createPlaylist } from '../playlists/playlists.thunks';
import { selectVideoById, selectVideoIdsFor } from './videos.selectors';
import { filterSet, loaded, querySet } from './videos.slice';
import { addEntries, moveToPosition } from './videos.thunks';

const realFetch = globalThis.fetch;
const scrollIntoView = vi.fn();
let SQL: SqlJsStatic;
let store: AppStore;
let playlistId: string;

const titles = () =>
    selectVideoIdsFor(store.getState(), playlistId).map((id) => selectVideoById(store.getState(), id)?.title);
const idOf = (title: string) =>
    store.getState().videos.ids.find((id) => store.getState().videos.entities[id]?.title === title)!;
const lastNotice = () => store.getState().ui.notices.at(-1);
const openBox = (title: string) => {
    render(<App store={store} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Position \\d+: move "${title}"$`) }));
    return screen.getByLabelText(`Position for ${title}`);
};

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
    Element.prototype.scrollIntoView = scrollIntoView;
});

afterAll(() => {
    globalThis.fetch = realFetch;
});

beforeEach(() => {
    scrollIntoView.mockClear();
    setDatabase(new Database(new SQL.Database()));
    store = createStore();
    playlistId = store.dispatch(createPlaylist({ name: 'City Pop' }))!.id;
    store.dispatch(
        addEntries(
            playlistId,
            ['One', 'Two', 'Three', 'Four', 'Five'].map((title, i) => ({
                youtubeId: `${'abcde'[i]!.repeat(11)}`,
                title,
            })),
        ),
    );
});

describe('moving to a position', () => {
    it('moves to the first position', () => {
        expect(store.dispatch(moveToPosition(idOf('Four'), '1'))).toBe(true);
        expect(titles()).toEqual(['Four', 'One', 'Two', 'Three', 'Five']);
    });

    it('moves to the last position', () => {
        store.dispatch(moveToPosition(idOf('Two'), '5'));
        expect(titles()).toEqual(['One', 'Three', 'Four', 'Five', 'Two']);
    });

    it('moves to a place in between, and the others keep their order', () => {
        store.dispatch(moveToPosition(idOf('One'), ' 3 '));
        expect(titles()).toEqual(['Two', 'Three', 'One', 'Four', 'Five']);
        store.dispatch(moveToPosition(idOf('Five'), '2'));
        expect(titles()).toEqual(['Two', 'Five', 'Three', 'One', 'Four']);
    });

    it('moves to the end with a number past it', () => {
        expect(store.dispatch(moveToPosition(idOf('One'), '999'))).toBe(true);
        expect(titles()).toEqual(['Two', 'Three', 'Four', 'Five', 'One']);
    });

    it.each(['', '  ', '0', '-1', '1.5', '2e3', 'abc'])('refuses %j with a message', (input) => {
        expect(store.dispatch(moveToPosition(idOf('Two'), input))).toBe(false);
        expect(titles()).toEqual(['One', 'Two', 'Three', 'Four', 'Five']);
        expect(lastNotice()).toMatchObject({ message: 'Enter a position from 1 to 5', tone: 'error' });
    });

    it('changes one video, so it syncs as one edit', () => {
        const db = getDatabase();
        markPushed(db, collectChanges(db));
        store.dispatch(moveToPosition(idOf('Five'), '2'));
        expect(collectChanges(db).videos.map((v) => v.title)).toEqual(['Five']);
    });

    it("changes nothing when it's already there", () => {
        const db = getDatabase();
        markPushed(db, collectChanges(db));
        expect(store.dispatch(moveToPosition(idOf('Two'), '2'))).toBe(true);
        expect(collectChanges(db).videos).toEqual([]);
    });

    it('uses the place in the whole playlist with a search active', () => {
        store.dispatch(querySet('T'));
        store.dispatch(moveToPosition(idOf('Three'), '5'));
        expect(titles()).toEqual(['One', 'Two', 'Four', 'Five', 'Three']);
    });

    it('uses the place in the whole playlist with the Missing filter on', () => {
        insertVideosAfter(getDatabase(), playlistId, [{ title: 'Lost', youtubeId: '', afterId: idOf('Five') }]);
        store.dispatch(loaded(listVideos(getDatabase())));
        store.dispatch(filterSet('missing'));
        store.dispatch(moveToPosition(idOf('Lost'), '2'));
        expect(titles()).toEqual(['One', 'Lost', 'Two', 'Three', 'Four', 'Five']);
    });
});

describe('the position box', () => {
    it('opens from the row number with the current position', () => {
        const input = openBox('Three') as HTMLInputElement;
        expect(input).toHaveValue('3');
        expect(input).toHaveFocus();
        expect([input.selectionStart, input.selectionEnd]).toEqual([0, 1]);
        expect(screen.getByRole('button', { name: 'Position 3: move "Three"' })).toHaveAttribute(
            'aria-expanded',
            'true',
        );
    });

    it('moves with Enter, closes, and brings the video into view', () => {
        const input = openBox('Five');
        fireEvent.change(input, { target: { value: '2' } });
        fireEvent.submit(input);

        expect(titles()).toEqual(['One', 'Five', 'Two', 'Three', 'Four']);
        expect(screen.queryByLabelText('Position for Five')).not.toBeInTheDocument();
        const number = screen.getByRole('button', { name: 'Position 2: move "Five"' });
        expect(number).toHaveFocus();
        expect(number.closest('li')).toHaveAttribute('data-moved');
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('moves to the top and the bottom in one click', () => {
        openBox('Three');
        fireEvent.click(screen.getByRole('button', { name: 'Top' }));
        expect(titles()).toEqual(['Three', 'One', 'Two', 'Four', 'Five']);

        fireEvent.click(screen.getByRole('button', { name: 'Position 1: move "Three"' }));
        expect(screen.getByRole('button', { name: 'Top' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Bottom' }));
        expect(titles()).toEqual(['One', 'Two', 'Four', 'Five', 'Three']);
    });

    it('stays open with a message when the input is refused', () => {
        const input = openBox('Two');
        fireEvent.change(input, { target: { value: 'soon' } });
        fireEvent.click(screen.getByRole('button', { name: 'Move' }));
        expect(screen.getByText('Enter a position from 1 to 5')).toBeInTheDocument();
        expect(input).toBeInTheDocument();
    });

    it('closes with Escape or Cancel without moving', () => {
        const input = openBox('Two');
        fireEvent.change(input, { target: { value: '4' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(screen.queryByLabelText('Position for Two')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Position 2: move "Two"' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByLabelText('Position for Two')).not.toBeInTheDocument();
        expect(titles()).toEqual(['One', 'Two', 'Three', 'Four', 'Five']);
    });

    it('shows the place in the whole playlist in a filtered list', () => {
        store.dispatch(querySet('Four'));
        render(<App store={store} />);
        fireEvent.click(screen.getByRole('button', { name: 'Position 4: move "Four"' }));
        expect(screen.getByLabelText('Position for Four')).toHaveValue('4');
        expect(screen.getByText('of 5')).toBeInTheDocument();
    });
});
