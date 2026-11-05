import { openBrowserDatabase } from '@ytpm/core/db/browser';
import { setDatabase } from '@ytpm/core/db/index';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createStore } from './app/store';
import { loadLibrary } from './domains/playlists/playlists.thunks';
import { followOtherTabs, startAutoSync } from './domains/sync/auto-sync';
import { loadSync } from './domains/sync/sync.thunks';

const start = async () => {
    const db = await openBrowserDatabase();
    setDatabase(db);
    const store = createStore();
    store.dispatch(loadSync());
    store.dispatch(loadLibrary());
    store.dispatch(startAutoSync());
    store.dispatch(followOtherTabs(db));
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <App store={store} />
        </StrictMode>,
    );
};

start();
