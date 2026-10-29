import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs from 'sql.js';
import { Database } from '../../core/db/database.js';
import * as playlists from '../playlists/playlists.repository.js';
import * as videos from '../videos/videos.repository.js';
import * as sync from './sync.repository.js';

let SQL;
beforeAll(async () => {
  SQL = await initSqlJs();
});
const freshDb = () => new Database(new SQL.Database());

describe('local repositories', () => {
  it('creates playlists, adds videos without duplicates and reorders', () => {
    const db = freshDb();
    const p = playlists.createPlaylist(db, { name: '  Cooking  ' });
    expect(p.name).toBe('Cooking');

    const { added, skipped } = videos.addVideos(db, p.id, ['dQw4w9WgXcQ', '9bZkp7q19f0', 'kJQP7kiw5Fk']);
    expect(added).toHaveLength(3);
    expect(skipped).toEqual([]);
    expect(videos.addVideos(db, p.id, ['dQw4w9WgXcQ']).skipped).toEqual(['dQw4w9WgXcQ']);

    // move the last video to the top
    videos.reorderVideo(db, added[2].id, 0);
    const order = videos
      .listVideos(db)
      .sort((a, b) => a.position - b.position)
      .map((v) => v.youtubeId);
    expect(order).toEqual(['kJQP7kiw5Fk', 'dQw4w9WgXcQ', '9bZkp7q19f0']);
  });

  it('soft-deletes a playlist together with its videos', () => {
    const db = freshDb();
    const p = playlists.createPlaylist(db, { name: 'Temp' });
    videos.addVideos(db, p.id, ['dQw4w9WgXcQ']);
    playlists.deletePlaylist(db, p.id);
    expect(playlists.listPlaylists(db)).toEqual([]);
    expect(videos.listVideos(db)).toEqual([]);
    const pending = sync.collectChanges(db);
    expect(pending.playlists[0].deleted).toBe(true);
    expect(pending.videos[0].deleted).toBe(true);
  });
});

describe('sync bookkeeping', () => {
  it('round-trips changes between two devices with last-write-wins', () => {
    const phone = freshDb();
    const laptop = freshDb();

    const p = playlists.createPlaylist(phone, { name: 'Shared' });
    const [v] = videos.addVideos(phone, p.id, ['dQw4w9WgXcQ']).added;

    // phone pushes; the "server" hands the same rows to the laptop
    const pushed = sync.collectChanges(phone);
    sync.markPushed(phone, pushed);
    expect(sync.countPending(phone)).toBe(0);
    expect(sync.applyRemote(laptop, pushed)).toBe(2);
    expect(sync.countPending(laptop)).toBe(0);
    expect(videos.listVideos(laptop)[0].youtubeId).toBe('dQw4w9WgXcQ');

    // laptop marks watched later; an older edit from the phone must not win
    videos.updateVideo(laptop, v.id, { watched: true });
    const fromLaptop = sync.collectChanges(laptop);
    const stale = { playlists: [], videos: [{ ...fromLaptop.videos[0], watched: false, updatedAt: v.updatedAt }] };
    expect(sync.applyRemote(laptop, stale)).toBe(0);
    expect(videos.getVideo(laptop, v.id).watched).toBe(true);

    expect(sync.applyRemote(phone, fromLaptop)).toBe(1);
    expect(videos.getVideo(phone, v.id).watched).toBe(true);
  });

  it('keeps rows dirty when they were edited while a push was in flight', () => {
    const db = freshDb();
    const p = playlists.createPlaylist(db, { name: 'A' });
    const inFlight = sync.collectChanges(db);
    playlists.updatePlaylist(db, p.id, { name: 'B' });
    sync.markPushed(db, inFlight);
    expect(sync.countPending(db)).toBe(1);
  });

  it('stores settings and resets the cursor when the server changes', () => {
    const db = freshDb();
    expect(sync.getSettings(db)).toEqual({ apiUrl: '/api', token: '', autoSync: true });
    sync.setCursor(db, 99);
    sync.saveSettings(db, { apiUrl: '/api', token: ' abc ', autoSync: false });
    expect(sync.getCursor(db)).toBe(99);
    expect(sync.getSettings(db)).toEqual({ apiUrl: '/api', token: 'abc', autoSync: false });
    sync.saveSettings(db, { apiUrl: 'https://other.example/api', token: 'abc', autoSync: true });
    expect(sync.getCursor(db)).toBe(0);
  });
});
