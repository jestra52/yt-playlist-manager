import { setDatabase } from '../core/db/index.js';
import { openBrowserDatabase } from '../core/db/browser.js';
import { playlists } from '../domains/playlists/playlists.service.svelte.js';
import { videos } from '../domains/videos/videos.service.svelte.js';
import { sync } from '../domains/sync/sync.service.svelte.js';

/** Opens the local database and loads every domain's state. */
export async function bootstrap() {
  const db = await openBrowserDatabase();
  setDatabase(db);
  sync.load();
  playlists.load();
  videos.load();
  sync.startAutoSync();
  videos.enrichMetadata();

  // Another tab saved the database: load its copy so this tab doesn't
  // overwrite those changes with stale data on its next save.
  if ('BroadcastChannel' in globalThis) {
    const channel = new BroadcastChannel('ytpm-db');
    db.onSaved(() => channel.postMessage('saved'));
    channel.onmessage = async () => {
      await db.reload();
      sync.load();
      playlists.load();
      videos.load();
    };
  }
  return db;
}
