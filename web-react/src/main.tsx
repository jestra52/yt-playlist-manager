import { openBrowserDatabase } from '@ytpm/core/db/browser';
import { setDatabase } from '@ytpm/core/db/index';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createStore } from './app/store';
import { loadLibrary } from './domains/playlists/playlists.thunks';

const start = async () => {
    setDatabase(await openBrowserDatabase());
    const store = createStore();
    store.dispatch(loadLibrary());
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <App store={store} />
        </StrictMode>,
    );
};

start();
