import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import { secretToWords } from '@ytpm/core/sync/chain-code';
import { meta } from '@ytpm/core/db/tables';
import { setChainAccess } from '@ytpm/core/sync/sync.repository';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { cancelJoinRequest } from './pairing.thunks';
import { selectConfigured, selectSyncSettings } from './sync.selectors';
import { syncFailed } from './sync.slice';
import { loadSync, saveSyncSettings } from './sync.thunks';

const SECRET = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const WORDS = secretToWords(SECRET);
const CODES = Array.from({ length: 10 }, (_, i) => `AAAAA-BBBBB-CCCCC-DDDD${i}`);
const access = { chainId: 'chain-1', deviceId: 'device-1', deviceCredential: 'credential' };

const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let db: Database;
let store: AppStore;
let pairingAnswer: object;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

const answer = (path: string): Response => {
    if (path.endsWith('/chains')) return json(201, { ...access, secret: SECRET, recoveryCodes: CODES });
    if (path.endsWith('/chains/join')) return json(200, { ...access, secret: null, recoveryCodes: null });
    if (path.endsWith('/chains/claim')) return json(200, { ...access, secret: SECRET, recoveryCodes: CODES });
    if (path.endsWith('/chains/recover')) return json(200, { ...access, secret: SECRET, recoveryCodes: CODES });
    if (path.endsWith('/chains/pair')) {
        return json(202, { requestToken: 'token', expiresAt: Date.now() + 300_000 });
    }
    if (path.endsWith('/pairing/status')) return json(200, pairingAnswer);
    if (path.includes('/chain/events')) return json(200, []);
    if (path.endsWith('/chain')) return json(200, { ...access, devices: [], recoveryCodesLeft: 10 });
    if (path.endsWith('/sync')) return json(200, { cursor: 1, hasMore: false, changes: {} });
    return json(404, { error: 'not found' });
};

const open = () => {
    render(<App store={store} />);
    fireEvent.click(screen.getByRole('button', { name: /Only on this device/ }));
    return within(screen.getByRole('dialog', { name: 'Sync across devices' }));
};

const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });

const confirmWords = (dialog: ReturnType<typeof within>) => {
    for (const field of dialog.getAllByLabelText(/^Word \d+$/)) {
        const position = Number(field.closest('label')?.textContent?.replace(/\D/g, ''));
        type(field, WORDS[position - 1]!);
    }
};

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = (async (url: string) => answer(String(url))) as typeof fetch;
});

afterAll(() => {
    globalThis.fetch = realFetch;
});

afterEach(() => {
    store.dispatch(saveSyncSettings({ autoSync: false }));
});

beforeEach(() => {
    pairingAnswer = { status: 'requested' };
    db = new Database(new SQL.Database());
    setDatabase(db);
    store = createStore({ ui: { sidebarOpen: true } });
    store.dispatch(cancelJoinRequest());
    store.dispatch(loadSync());
});

describe('sidebar status', () => {
    it('opens the settings, and closes them with the X', async () => {
        const dialog = open();
        expect(dialog.getByText('Create a sync chain')).toBeInTheDocument();
        fireEvent.click(dialog.getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: /Sync/ })).not.toBeInTheDocument());
        expect(store.getState().ui.settingsOpen).toBe(false);
    });

    it('pauses Sync now for a moment after pressing it', async () => {
        setChainAccess(db, access);
        store.dispatch(loadSync());
        render(<App store={store} />);
        const button = screen.getByRole('button', { name: 'Sync now' });
        fireEvent.click(button);
        await waitFor(() => expect(store.getState().sync.status).not.toBe('syncing'));
        expect(button).toBeDisabled();
    });

    it('names the state of a device in a chain, with the reason for a failure', () => {
        setChainAccess(db, access);
        store.dispatch(loadSync());
        render(<App store={store} />);
        expect(screen.getByText(/changes to sync|change to sync|Synced/)).toBeInTheDocument();

        act(() => {
            store.dispatch(syncFailed({ error: "Can't reach the sync server", offline: false }));
        });
        expect(screen.getByRole('button', { name: /Sync failed/ })).toHaveAttribute(
            'title',
            "Can't reach the sync server",
        );

        act(() => {
            store.dispatch(syncFailed({ error: 'Too many attempts', offline: false, waitMs: 60_000 }));
        });
        expect(screen.getByText('Waiting to sync')).toBeInTheDocument();

        act(() => {
            store.dispatch(syncFailed({ error: "You're offline", offline: true }));
        });
        expect(screen.getByText('Offline. Changes are saved here.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sync now' })).toBeInTheDocument();
    });
});

describe('creating a chain', () => {
    it('shows the code once, and only lets go after typing back three of its words', async () => {
        const dialog = open();
        fireEvent.click(dialog.getByRole('button', { name: 'Create a sync chain' }));

        expect(await dialog.findByText('Save your sync chain code')).toBeInTheDocument();
        expect(dialog.getByText(CODES[0]!)).toBeInTheDocument();
        const done = dialog.getByRole('button', { name: "I've saved the code" });
        expect(done).toBeDisabled();

        confirmWords(dialog);
        expect(done).toBeEnabled();
        fireEvent.click(done);

        expect(await dialog.findByText(/This device is in a sync chain/)).toBeInTheDocument();
        expect(store.getState().sync.newCode).toBeNull();
    });
});

describe('joining with the chain code', () => {
    it('counts the words, catches a mistyped code and joins with the right one', async () => {
        const dialog = open();
        fireEvent.click(dialog.getByRole('button', { name: 'Enter the chain code' }));
        const code = dialog.getByLabelText(/Sync chain code/);
        const join = dialog.getByRole('button', { name: 'Join' });

        type(code, WORDS.slice(0, 3).join(' '));
        expect(dialog.getByText('3 of 24 words')).toBeInTheDocument();
        expect(join).toBeDisabled();

        type(code, [...WORDS.slice(0, 23), 'notaword'].join(' '));
        expect(dialog.getByText(/isn't in the list/)).toBeInTheDocument();
        expect(join).toBeDisabled();

        type(code, WORDS.join(' '));
        fireEvent.click(join);
        await waitFor(() => expect(selectConfigured(store.getState())).toBe(true));
        expect(await dialog.findByText(/This device is in a sync chain/)).toBeInTheDocument();
    });
});

describe('joining with a pairing code', () => {
    const askToJoin = (dialog: ReturnType<typeof within>) => {
        fireEvent.click(dialog.getByRole('button', { name: 'Enter a pairing code' }));
        const code = dialog.getByLabelText(/Pairing code/);
        const ask = dialog.getByRole('button', { name: 'Ask to join' });
        expect(ask).toBeDisabled();
        type(code, '7k3qd9x2');
        fireEvent.click(ask);
    };

    it('waits for approval, and can be cancelled', async () => {
        const dialog = open();
        askToJoin(dialog);
        expect(await dialog.findByText('Waiting for approval')).toBeInTheDocument();

        fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(store.getState().sync.joinRequest).toBeNull());
        expect(dialog.getByRole('button', { name: 'Ask to join' })).toBeInTheDocument();
    });

    it('says when the other device refused', async () => {
        pairingAnswer = { status: 'denied' };
        const dialog = open();
        askToJoin(dialog);
        expect(await dialog.findByText(/refused to let this one join/)).toBeInTheDocument();
    });
});

describe('recovering', () => {
    it('warns what happens, and asks for the whole code', async () => {
        const dialog = open();
        fireEvent.click(dialog.getByRole('button', { name: 'Recover with a recovery code' }));
        expect(dialog.getByText(/every other device is removed/)).toBeInTheDocument();
        const recover = dialog.getByRole('button', { name: 'Recover' });
        expect(recover).toBeDisabled();

        type(dialog.getByLabelText(/Recovery code/), CODES[0]!);
        fireEvent.click(recover);
        expect(await dialog.findByText('Save your sync chain code')).toBeInTheDocument();
    });
});

describe('a library from the old sync token', () => {
    it('can become a sync chain', async () => {
        db.write(db.orm.insert(meta).values({ key: 'sync.token', value: 'old-token' }));
        store.dispatch(loadSync());
        const dialog = open();
        fireEvent.click(dialog.getByRole('button', { name: 'Turn it into a sync chain' }));
        expect(await dialog.findByText('Save your sync chain code')).toBeInTheDocument();
        expect(selectSyncSettings(store.getState()).legacyToken).toBe('');
    });
});

describe('settings', () => {
    it('asks for no API address', () => {
        const dialog = open();
        expect(dialog.queryByLabelText(/API address/)).not.toBeInTheDocument();
    });

    const reopenWith = (apiUrl: string) => {
        setChainAccess(db, access);
        db.write(db.orm.insert(meta).values({ key: 'sync.apiUrl', value: apiUrl }));
        store.dispatch(loadSync());
        return selectSyncSettings(store.getState());
    };

    it('keeps the chain of a device on /api', () => {
        expect(reopenWith('/api')).toMatchObject({ apiUrl: '/api', credential: access.deviceCredential });
    });

    it('goes back to /api and leaves a chain on another address', () => {
        expect(reopenWith('https://other.example/api')).toMatchObject({ apiUrl: '/api', credential: '' });
    });

    it('downloads the database', () => {
        const create = vi.fn(() => 'blob:database');
        vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: () => {} }));
        const dialog = open();
        fireEvent.click(dialog.getByRole('button', { name: 'Export database' }));
        expect(create).toHaveBeenCalledOnce();
        vi.unstubAllGlobals();
    });
});

describe('the first screen', () => {
    it('offers to connect sync', () => {
        store = createStore();
        render(<App store={store} />);
        fireEvent.click(screen.getByRole('button', { name: 'Connect sync' }));
        expect(screen.getByRole('dialog', { name: 'Sync across devices' })).toBeInTheDocument();
    });
});
