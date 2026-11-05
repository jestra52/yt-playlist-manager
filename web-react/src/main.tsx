import { openBrowserDatabase } from '@ytpm/core/db/browser';
import type { Database } from '@ytpm/core/db/database';
import { setDatabase } from '@ytpm/core/db/index';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createStore } from './app/store';
import { loadLibrary } from './domains/playlists/playlists.thunks';
import { followOtherTabs, startAutoSync } from './domains/sync/auto-sync';
import { loadSync } from './domains/sync/sync.thunks';
import { OpenFailed } from './domains/ui/components/feedback/OpenFailed';
import { selectAllVideos } from './domains/videos/videos.selectors';
import { enrichMetadata } from './domains/videos/videos.thunks';

const open = (db: Database) => {
    setDatabase(db);
    const store = createStore();
    store.dispatch(loadSync());
    store.dispatch(loadLibrary());
    store.dispatch(startAutoSync());
    store.dispatch(followOtherTabs(db));
    store.dispatch(enrichMetadata(selectAllVideos(store.getState()).filter((v) => !v.title && !v.missing)));
    return store;
};

const start = async () => {
    const root = createRoot(document.getElementById('root')!);
    try {
        const store = open(await openBrowserDatabase());
        root.render(
            <StrictMode>
                <App store={store} />
            </StrictMode>,
        );
    } catch (err) {
        console.error(err);
        root.render(<OpenFailed reason={(err as Error)?.message ?? String(err)} />);
    }
};

start();
