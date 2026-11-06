import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { Database } from '../db/database';
import { meta } from '../db/tables';
import * as playlists from '../playlists/playlists.repository';
import * as videos from '../videos/videos.repository';
import * as sync from './sync.repository';

let SQL: SqlJsStatic;
beforeAll(async () => {
    SQL = await initSqlJs();
});
const freshDb = () => new Database(new SQL.Database());

describe('local repositories', () => {
    it('creates playlists, adds videos without duplicates and reorders', () => {
        const db = freshDb();
        const p = playlists.createPlaylist(db, { name: '  Cooking  ' })!;
        expect(p.name).toBe('Cooking');

        const { added, skipped } = videos.addVideos(db, p.id, ['dQw4w9WgXcQ', '9bZkp7q19f0', 'kJQP7kiw5Fk']);
        expect(added).toHaveLength(3);
        expect(skipped).toEqual([]);
        expect(videos.addVideos(db, p.id, ['dQw4w9WgXcQ']).skipped).toEqual(['dQw4w9WgXcQ']);

        // move the last video to the top
        videos.reorderVideo(db, added[2]!.id, 0);
        const order = videos
            .listVideos(db)
            .sort((a, b) => a.position - b.position)
            .map((v) => v.youtubeId);
        expect(order).toEqual(['kJQP7kiw5Fk', 'dQw4w9WgXcQ', '9bZkp7q19f0']);
    });

    it('soft-deletes a playlist together with its videos', () => {
        const db = freshDb();
        const p = playlists.createPlaylist(db, { name: 'Temp' })!;
        videos.addVideos(db, p.id, ['dQw4w9WgXcQ']);
        playlists.deletePlaylist(db, p.id);
        expect(playlists.listPlaylists(db)).toEqual([]);
        expect(videos.listVideos(db)).toEqual([]);
        const pending = sync.collectChanges(db);
        expect(pending.playlists[0]!.deleted).toBe(true);
        expect(pending.videos[0]!.deleted).toBe(true);
    });
});

describe('sync bookkeeping', () => {
    it('round-trips changes between two devices with last-write-wins', () => {
        const phone = freshDb();
        const laptop = freshDb();

        const p = playlists.createPlaylist(phone, { name: 'Shared' })!;
        const v = videos.addVideos(phone, p.id, ['dQw4w9WgXcQ']).added[0]!;

        // phone pushes; the "server" hands the same rows to the laptop
        const pushed = sync.collectChanges(phone);
        sync.markPushed(phone, pushed);
        expect(sync.countPending(phone)).toBe(0);
        expect(sync.applyRemote(laptop, pushed)).toBe(2);
        expect(sync.countPending(laptop)).toBe(0);
        expect(videos.listVideos(laptop)[0]!.youtubeId).toBe('dQw4w9WgXcQ');

        // laptop marks watched later; an older edit from the phone must not win
        videos.updateVideo(laptop, v.id, { watched: true });
        const fromLaptop = sync.collectChanges(laptop);
        const stale = { playlists: [], videos: [{ ...fromLaptop.videos[0]!, watched: false, updatedAt: v.updatedAt }] };
        expect(sync.applyRemote(laptop, stale)).toBe(0);
        expect(videos.getVideo(laptop, v.id)!.watched).toBe(true);

        expect(sync.applyRemote(phone, fromLaptop)).toBe(1);
        expect(videos.getVideo(phone, v.id)!.watched).toBe(true);
    });

    it('syncs the artist and where it came from', () => {
        const phone = freshDb();
        const laptop = freshDb();
        const p = playlists.createPlaylist(phone, { name: 'Shared' })!;
        const v = videos.addVideos(phone, p.id, [
            { youtubeId: 'dQw4w9WgXcQ', title: 'Windy Summer', artist: 'Anri', artistSource: 'guess' },
        ]).added[0]!;
        sync.applyRemote(laptop, sync.collectChanges(phone));
        expect(videos.getVideo(laptop, v.id)!).toMatchObject({ artist: 'Anri', artistSource: 'guess' });

        videos.updateVideo(laptop, v.id, { artist: '杏里', artistSource: 'user' });
        sync.applyRemote(phone, sync.collectChanges(laptop));
        expect(videos.getVideo(phone, v.id)!).toMatchObject({ artist: '杏里', artistSource: 'user' });
    });

    it('keeps local artists when the server sends rows without them', () => {
        const db = freshDb();
        const p = playlists.createPlaylist(db, { name: 'A' })!;
        const v = videos.addVideos(db, p.id, [{ youtubeId: 'dQw4w9WgXcQ', artist: 'Anri', artistSource: 'user' }])
            .added[0]!;
        const { artist, artistSource, ...fromOldServer } = sync.collectChanges(db).videos[0]!;
        expect([artist, artistSource]).toEqual(['Anri', 'user']);

        sync.applyRemote(db, { videos: [{ ...fromOldServer, watched: true, updatedAt: v.updatedAt + 1 }] });
        expect(videos.getVideo(db, v.id)!).toMatchObject({ watched: true, artist: 'Anri', artistSource: 'user' });
    });

    it('syncs where a playlist came from and which videos are gone from YouTube', () => {
        const phone = freshDb();
        const laptop = freshDb();
        const p = playlists.createPlaylist(phone, { name: 'Road trip', source: 'youtube', sourceId: 'PLabcdefghij' })!;
        const v = videos.addVideos(phone, p.id, [
            { youtubeId: 'aaaaaaaaaaa', title: 'Deleted video', unavailable: true },
        ]).added[0]!;
        sync.applyRemote(laptop, sync.collectChanges(phone));
        expect(playlists.getPlaylist(laptop, p.id)!).toMatchObject({ source: 'youtube', sourceId: 'PLabcdefghij' });
        expect(videos.getVideo(laptop, v.id)!).toMatchObject({ unavailable: true, missing: true });
    });

    it('keeps the source and the unavailable flag when the server sends rows without them', () => {
        const db = freshDb();
        const p = playlists.createPlaylist(db, { name: 'Road trip', source: 'youtube', sourceId: 'PLabcdefghij' })!;
        const v = videos.addVideos(db, p.id, [{ youtubeId: 'aaaaaaaaaaa', unavailable: true }]).added[0]!;
        const pending = sync.collectChanges(db);
        const { source, sourceId, ...oldPlaylist } = pending.playlists[0]!;
        const { unavailable, ...oldVideo } = pending.videos[0]!;
        expect([source, sourceId, unavailable]).toEqual(['youtube', 'PLabcdefghij', true]);

        sync.applyRemote(db, {
            playlists: [{ ...oldPlaylist, name: 'Renamed', updatedAt: p.updatedAt + 1 }],
            videos: [{ ...oldVideo, watched: true, updatedAt: v.updatedAt + 1 }],
        });
        expect(playlists.getPlaylist(db, p.id)!).toMatchObject({ name: 'Renamed', source: 'youtube' });
        expect(videos.getVideo(db, v.id)!).toMatchObject({ watched: true, unavailable: true });
    });

    it('keeps rows dirty when they were edited while a push was in flight', () => {
        const db = freshDb();
        const p = playlists.createPlaylist(db, { name: 'A' })!;
        const inFlight = sync.collectChanges(db);
        playlists.updatePlaylist(db, p.id, { name: 'B' });
        sync.markPushed(db, inFlight);
        expect(sync.countPending(db)).toBe(1);
    });

    const access = { chainId: 'chain-1', deviceId: 'device-1', deviceCredential: 'credential-1' };

    it('stores settings, and a different server leaves the chain and starts over', () => {
        const db = freshDb();
        expect(sync.getSettings(db)).toEqual({
            apiUrl: '/api',
            credential: '',
            chainId: '',
            deviceId: '',
            legacyToken: '',
            autoSync: true,
        });
        sync.setChainAccess(db, access);
        sync.setCursor(db, 99);
        sync.saveSettings(db, { apiUrl: ' /api ', autoSync: false });
        expect(sync.getCursor(db)).toBe(99);
        expect(sync.getSettings(db)).toMatchObject({ apiUrl: '/api', credential: 'credential-1', autoSync: false });

        sync.saveSettings(db, { apiUrl: 'https://other.example/api', autoSync: true });
        expect(sync.getCursor(db)).toBe(0);
        expect(sync.getSettings(db)).toMatchObject({ credential: '', chainId: '', deviceId: '' });

        sync.setChainAccess(db, access);
        sync.saveSettings(db, { autoSync: false });
        expect(sync.getSettings(db)).toMatchObject({ apiUrl: '/api', autoSync: false });
    });

    it('syncs the replaced ID, and keeps it when a device leaves it out', () => {
        const db = freshDb();
        const row = {
            id: 'v1',
            playlistId: 'p1',
            youtubeId: 'bbbbbbbbbbb',
            createdAt: 1,
            updatedAt: 2,
            replacedYoutubeId: 'aaaaaaaaaaa',
        };
        sync.applyRemote(db, { videos: [row] });
        expect(sync.collectChanges(db).videos).toEqual([]);

        const { replacedYoutubeId: _, ...older } = row;
        sync.applyRemote(db, { videos: [{ ...older, updatedAt: 3 }] });
        expect(videos.listVideos(db)[0]).toMatchObject({ replacedYoutubeId: 'aaaaaaaaaaa' });
    });

    it("joining a chain merges this device's library into it; claiming keeps the cursor", () => {
        const db = freshDb();
        const p = playlists.createPlaylist(db, { name: 'Mine' })!;
        sync.markPushed(db, sync.collectChanges(db));
        sync.setCursor(db, 42);

        sync.setChainAccess(db, access, { claimed: true });
        expect(sync.getCursor(db)).toBe(42);
        expect(sync.countPending(db)).toBe(0);

        sync.setChainAccess(db, access);
        expect(sync.getCursor(db)).toBe(0);
        expect(sync.collectChanges(db).playlists.map((x) => x.id)).toEqual([p.id]);
    });

    it('forgets the old sync token once in a chain, and forgets the chain when leaving', () => {
        const db = freshDb();
        // A token saved by the app before sync chains, under its old key.
        db.write(db.orm.insert(meta).values({ key: 'sync.token', value: 'old-token' }));
        expect(sync.getSettings(db).legacyToken).toBe('old-token');

        sync.setChainAccess(db, access, { claimed: true });
        expect(sync.getSettings(db)).toMatchObject({ legacyToken: '', chainId: 'chain-1', deviceId: 'device-1' });

        sync.clearChainAccess(db);
        expect(sync.getSettings(db)).toMatchObject({ credential: '', chainId: '', deviceId: '' });
    });

    it('remembers when the codes were last checked, until the device leaves the chain', () => {
        const db = freshDb();
        expect(sync.getCodeCheckedAt(db)).toBeNull();

        const before = Date.now();
        sync.setChainAccess(db, access);
        expect(sync.getCodeCheckedAt(db)).toBeGreaterThanOrEqual(before);

        sync.setCodeCheckedAt(db, 1234);
        expect(sync.getCodeCheckedAt(db)).toBe(1234);
        sync.clearChainAccess(db);
        expect(sync.getCodeCheckedAt(db)).toBeNull();
    });
});
