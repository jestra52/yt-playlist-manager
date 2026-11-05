import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import { secretToWords } from '@ytpm/core/sync/chain-code';
import { setChainAccess } from '@ytpm/core/sync/sync.repository';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createStore, type AppStore } from '../../app/store';
import { selectConfigured } from './sync.selectors';
import { codeChecked } from './sync.slice';
import { loadChain, loadSync, saveSyncSettings } from './sync.thunks';

const SECRET = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const CODES = Array.from({ length: 10 }, (_, i) => `EEEEE-FFFFF-GGGGG-HHHH${i}`);
const access = { chainId: 'chain-1', deviceId: 'device-1', deviceCredential: 'credential' };
const laptop = { id: 'device-1', name: 'Laptop', createdAt: 1, lastSeenAt: 1 };
const phone = { id: 'device-2', name: 'Phone', createdAt: 2, lastSeenAt: 2 };

type Dialog = ReturnType<typeof within>;

const realFetch = globalThis.fetch;
let SQL: SqlJsStatic;
let db: Database;
let store: AppStore;
let calls: { path: string; method?: string }[];
let devices: (typeof laptop)[];
let recoveryCodesLeft: number;
let pairingLockedUntil: number | null;
let pairingInfo: object;

const reply = (status: number, body: unknown) => new Response(status === 204 ? null : JSON.stringify(body), { status });

const answer = (path: string, method?: string): Response => {
    if (path.endsWith('/chain/pairing') && method === 'POST') {
        return reply(201, { code: '7K3Q-D9X2', expiresAt: Date.now() + 600_000 });
    }
    if (path.endsWith('/chain/pairing') && method === 'GET') return reply(200, pairingInfo);
    if (path.includes('/chain/pairing')) return reply(204, null);
    if (path.endsWith('/chain/replace')) return reply(200, { secret: SECRET, recoveryCodes: CODES });
    if (path.endsWith('/chain/recovery-codes')) return reply(200, { codes: CODES });
    if (path.includes('/chain/events')) {
        return reply(200, [{ at: 1000, kind: 'device_removed', deviceName: 'Laptop', detail: 'Phone' }]);
    }
    if (path.includes('/chain/devices/')) {
        devices = devices.filter((d) => !path.endsWith(d.id));
        return reply(204, null);
    }
    if (path.endsWith('/chain') && method === 'DELETE') return reply(204, null);
    if (path.endsWith('/chain')) {
        return reply(200, { ...access, devices, recoveryCodesLeft, pairingLockedUntil });
    }
    if (path.endsWith('/sync')) return reply(200, { cursor: 1, hasMore: false, changes: {} });
    return reply(404, { error: 'not found' });
};

const open = async (): Promise<Dialog> => {
    await store.dispatch(loadChain());
    render(<App store={store} />);
    fireEvent.click(screen.getByRole('button', { name: /Synced/ }));
    return within(screen.getByRole('dialog', { name: 'Sync across devices' }));
};

const tab = (dialog: Dialog, name: string) => fireEvent.click(dialog.getByRole('tab', { name }));
const button = (dialog: Dialog, name: string | RegExp) => dialog.getByRole('button', { name });

beforeAll(async () => {
    SQL = await initSqlJs();
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
        calls.push({ path: String(url), method: init.method });
        return answer(String(url), init.method);
    }) as typeof fetch;
});

afterAll(() => {
    globalThis.fetch = realFetch;
});

afterEach(() => {
    store.dispatch(saveSyncSettings({ apiUrl: '/api', autoSync: false }));
});

beforeEach(() => {
    calls = [];
    devices = [laptop, phone];
    recoveryCodesLeft = 10;
    pairingLockedUntil = null;
    pairingInfo = { status: 'waiting', requesterName: '', expiresAt: Date.now() + 600_000 };
    db = new Database(new SQL.Database());
    setDatabase(db);
    setChainAccess(db, access);
    store = createStore({ ui: { sidebarOpen: true } });
    store.dispatch(loadSync());
});

describe('devices', () => {
    it('opens on the devices, and asks twice before removing one', async () => {
        const dialog = await open();
        expect(dialog.getByRole('tab', { name: 'Devices' })).toHaveAttribute('aria-selected', 'true');
        expect(dialog.getByText('This device')).toBeInTheDocument();
        expect(dialog.queryByRole('button', { name: 'Remove Laptop' })).not.toBeInTheDocument();

        fireEvent.click(button(dialog, 'Remove Phone'));
        expect(calls.some((c) => c.path.includes('/chain/devices/'))).toBe(false);

        fireEvent.click(button(dialog, 'Confirm removing Phone'));
        await waitFor(() => expect(dialog.queryByText('Phone')).not.toBeInTheDocument());
    });

    it('shows a pairing code, and approves the device that entered it', async () => {
        const dialog = await open();
        fireEvent.click(button(dialog, 'Show a pairing code'));
        expect(await dialog.findByLabelText('Pairing code')).toHaveTextContent('7K3Q-D9X2');

        pairingInfo = { status: 'requested', requesterName: 'Chrome on Android', expiresAt: Date.now() + 300_000 };
        expect(await dialog.findByText('Allow Chrome on Android to join?', {}, { timeout: 4000 })).toBeInTheDocument();

        fireEvent.click(button(dialog, 'Allow'));
        expect(await dialog.findByText(/Waiting for Chrome on Android to finish joining/)).toBeInTheDocument();
    }, 8000);

    it('stops the pairing code when leaving the tab', async () => {
        const dialog = await open();
        fireEvent.click(button(dialog, 'Show a pairing code'));
        await dialog.findByLabelText('Pairing code');

        tab(dialog, 'Activity');
        await waitFor(() => expect(store.getState().sync.pairing).toBeNull());
        expect(calls.some((c) => c.path.endsWith('/chain/pairing') && c.method === 'DELETE')).toBe(true);
    });
});

describe('reminders', () => {
    it('warns when this is the only way back in', async () => {
        devices = [laptop];
        recoveryCodesLeft = 0;
        const dialog = await open();
        expect(dialog.getByText(/so you don't lose access/)).toBeInTheDocument();
        fireEvent.click(button(dialog, 'Create recovery codes'));
        expect(await dialog.findByText('Save your recovery codes')).toBeInTheDocument();
    });

    it('checks in, and sends someone who lost the codes to a new code', async () => {
        store.dispatch(codeChecked(Date.now() - 91 * 24 * 60 * 60 * 1000));
        const dialog = await open();
        fireEvent.click(button(dialog, 'No'));
        fireEvent.click(button(dialog, 'A new code…'));

        expect(dialog.getByRole('tab', { name: 'Security' })).toHaveAttribute('aria-selected', 'true');
        expect(button(dialog, 'Yes, new code and remove other devices')).toBeInTheDocument();
    });

    it('stops asking once they say they have them', async () => {
        store.dispatch(codeChecked(Date.now() - 91 * 24 * 60 * 60 * 1000));
        const dialog = await open();
        fireEvent.click(button(dialog, 'Yes, I have them'));
        expect(dialog.queryByText(/Do you still have/)).not.toBeInTheDocument();
    });

    it('puts a pause in pairing first, in place of adding a device', async () => {
        pairingLockedUntil = Date.now() + 3_600_000;
        const dialog = await open();
        expect(dialog.getByText('Adding devices with a pairing code is paused')).toBeInTheDocument();
        expect(dialog.queryByRole('button', { name: 'Show a pairing code' })).not.toBeInTheDocument();
    });
});

describe('security', () => {
    it('explains a new code before making it, then shows it', async () => {
        const dialog = await open();
        tab(dialog, 'Security');
        fireEvent.click(button(dialog, 'Generate a new code'));
        expect(dialog.getByRole('alert')).toHaveTextContent('every other device is removed');
        expect(calls.some((c) => c.path.endsWith('/chain/replace'))).toBe(false);

        fireEvent.click(button(dialog, 'Yes, new code and remove other devices'));
        expect(await dialog.findByText('Save your sync chain code')).toBeInTheDocument();
        expect(dialog.getByText(secretToWords(SECRET)[0]!)).toBeInTheDocument();
    });

    it('renews the recovery codes after a second click', async () => {
        const dialog = await open();
        tab(dialog, 'Security');
        fireEvent.click(button(dialog, 'Generate new recovery codes'));
        fireEvent.click(button(dialog, 'Yes, new recovery codes'));
        expect(await dialog.findByText('Save your recovery codes')).toBeInTheDocument();
    });

    it('leaves the chain after a second click, keeping the dialog on the start screen', async () => {
        const dialog = await open();
        tab(dialog, 'Security');
        fireEvent.click(button(dialog, 'Leave this chain'));
        expect(dialog.getByRole('alert')).toHaveTextContent('Its playlists stay here');

        fireEvent.click(button(dialog, 'Yes, leave'));
        await waitFor(() => expect(selectConfigured(store.getState())).toBe(false));
        expect(button(dialog, 'Create a sync chain')).toBeInTheDocument();
    });

    it('deletes the chain after a second click', async () => {
        const dialog = await open();
        tab(dialog, 'Security');
        fireEvent.click(button(dialog, 'Delete the sync chain'));
        expect(dialog.getByRole('alert')).toHaveTextContent("the server's copy");

        fireEvent.click(button(dialog, 'Yes, delete it for every device'));
        await waitFor(() => expect(selectConfigured(store.getState())).toBe(false));
        expect(calls.some((c) => c.path.endsWith('/chain') && c.method === 'DELETE')).toBe(true);
    });

    it('asks again when the click goes to a different action', async () => {
        const dialog = await open();
        tab(dialog, 'Security');
        fireEvent.click(button(dialog, 'Delete the sync chain'));
        fireEvent.click(button(dialog, 'Leave this chain'));
        expect(button(dialog, 'Delete the sync chain')).toBeInTheDocument();
        expect(selectConfigured(store.getState())).toBe(true);
    });
});

describe('activity and settings', () => {
    it('shows what happened in the chain', async () => {
        const dialog = await open();
        tab(dialog, 'Activity');
        expect(await dialog.findByText('Laptop removed Phone')).toBeInTheDocument();
    });

    it('keeps the connection and the export in Settings', async () => {
        const dialog = await open();
        expect(dialog.queryByRole('button', { name: 'Export database' })).not.toBeInTheDocument();
        tab(dialog, 'Settings');
        expect(button(dialog, 'Connection')).toBeInTheDocument();
        expect(button(dialog, 'Export database')).toBeInTheDocument();
    });
});
