import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import initSqlJs from 'sql.js';
import { Database } from '../../core/db/database.js';
import { setDatabase } from '../../core/db/index.js';
import { onDataChanged } from '../../core/events.js';
import { playlists } from '../playlists/playlists.service.svelte.js';
import { ui } from '../ui/ui.service.svelte.js';
import { videos } from './videos.service.svelte.js';

let SQL;
beforeAll(async () => {
  SQL = await initSqlJs();
  // No network in tests: metadata lookups resolve to "unknown".
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
});

beforeEach(() => {
  setDatabase(new Database(new SQL.Database()));
  playlists.load();
  videos.load();
  videos.setFilter('all');
  videos.setQuery('');
});

describe('playlists and videos services', () => {
  it('adds pasted links, reports duplicates and signals a data change', () => {
    let changes = 0;
    const stop = onDataChanged(() => changes++);
    const p = playlists.create('Music');
    expect(playlists.selected.name).toBe('Music');

    expect(videos.addFromText('https://youtu.be/dQw4w9WgXcQ 9bZkp7q19f0 nope', p.id)).toBe(true);
    expect(videos.forPlaylist(p.id).map((v) => v.youtubeId)).toEqual(['dQw4w9WgXcQ', '9bZkp7q19f0']);
    expect(ui.notices.at(-1).message).toBe('Added 2 videos. 1 link skipped');

    expect(videos.addFromText('dQw4w9WgXcQ', p.id)).toBe(false);
    expect(ui.notices.at(-1).message).toBe('1 video already in this playlist');
    expect(changes).toBeGreaterThanOrEqual(2);
    stop();
  });

  it('filters, searches, reorders and plays the next unwatched video', () => {
    const p = playlists.create('Queue');
    videos.addFromText('dQw4w9WgXcQ 9bZkp7q19f0 kJQP7kiw5Fk', p.id);
    const [a, b, c] = videos.forPlaylist(p.id);

    videos.setWatched(a.id, true);
    videos.setFilter('unwatched');
    expect(videos.visibleFor(p.id).map((v) => v.id)).toEqual([b.id, c.id]);
    videos.setFilter('all');
    videos.saveNotes(c.id, 'great chorus');
    videos.setQuery('chorus');
    expect(videos.visibleFor(p.id).map((v) => v.id)).toEqual([c.id]);
    videos.setQuery('');

    videos.reorder(c.id, 0);
    expect(videos.forPlaylist(p.id).map((v) => v.id)).toEqual([c.id, a.id, b.id]);

    videos.play(c.id);
    videos.finishAndPlayNext();
    expect(videos.playing.id).toBe(b.id);
    expect(videos.counts[p.id]).toEqual({ total: 3, watched: 2 });
  });

  it('removes with undo, and deleting a playlist drops its videos', () => {
    const p = playlists.create('Temp');
    const keep = playlists.create('Keep');
    videos.addFromText('dQw4w9WgXcQ 9bZkp7q19f0', p.id);
    const [first] = videos.forPlaylist(p.id);

    videos.remove(first.id);
    expect(videos.forPlaylist(p.id)).toHaveLength(1);
    ui.notices.at(-1).undo();
    expect(videos.forPlaylist(p.id)).toHaveLength(2);

    videos.moveToPlaylist(first.id, keep);
    expect(videos.forPlaylist(keep.id)).toHaveLength(1);

    playlists.select(p.id);
    playlists.remove(p.id);
    expect(playlists.items.map((x) => x.name)).toEqual(['Keep']);
    expect(playlists.selectedId).toBe(keep.id);
    expect(videos.items.map((v) => v.playlistId)).toEqual([keep.id]);
  });
});
