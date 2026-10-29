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
    // No network in tests: metadata lookups fail, playlist imports are served from fixtures.
    globalThis.fetch = async (url) => {
        const match = String(url).match(/\/api\/playlist\?id=([^&]+)/);
        const playlist = match && PLAYLISTS[decodeURIComponent(match[1])];
        if (playlist) return { ok: true, status: 200, json: async () => playlist };
        if (match)
            return { ok: false, status: 404, json: async () => ({ error: 'playlist not found, or it is private' }) };
        return { ok: false, status: 503, json: async () => ({}) };
    };
});

const LIST = 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';
const PLAYLISTS = {
    [LIST]: {
        id: LIST,
        title: 'Road trip',
        author: 'Juan',
        skipped: 1,
        partial: false,
        source: 'api',
        videos: [
            { youtubeId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', author: 'Rick Astley', thumbnailUrl: '' },
            { youtubeId: 'kJQP7kiw5Fk', title: 'Despacito', author: 'Luis Fonsi', thumbnailUrl: '' },
        ],
    },
    PLpartialpartialpartial: {
        id: 'PLpartialpartialpartial',
        title: 'Latest uploads',
        author: '',
        skipped: 0,
        partial: true,
        source: 'feed',
        videos: [{ youtubeId: '9bZkp7q19f0', title: 'Gangnam Style', author: 'PSY', thumbnailUrl: '' }],
    },
};

beforeEach(() => {
    setDatabase(new Database(new SQL.Database()));
    playlists.load();
    videos.load();
    videos.setFilter('all');
    videos.setQuery('');
});

describe('playlists and videos services', () => {
    it('adds pasted links, reports duplicates and signals a data change', async () => {
        let changes = 0;
        const stop = onDataChanged(() => changes++);
        const p = playlists.create('Music');
        expect(playlists.selected.name).toBe('Music');

        expect(await videos.addFromText('https://youtu.be/dQw4w9WgXcQ 9bZkp7q19f0 nope', p.id)).toBe(true);
        expect(videos.forPlaylist(p.id).map((v) => v.youtubeId)).toEqual(['dQw4w9WgXcQ', '9bZkp7q19f0']);
        expect(ui.notices.at(-1).message).toBe('Added 2 videos. 1 link skipped');

        expect(await videos.addFromText('dQw4w9WgXcQ', p.id)).toBe(false);
        expect(ui.notices.at(-1).message).toBe('1 video already in this playlist');
        expect(changes).toBeGreaterThanOrEqual(2);
        stop();
    });

    it('filters, searches, reorders and plays the next unwatched video', async () => {
        const p = playlists.create('Queue');
        await videos.addFromText('dQw4w9WgXcQ 9bZkp7q19f0 kJQP7kiw5Fk', p.id);
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

    it('removes with undo, and deleting a playlist drops its videos', async () => {
        const p = playlists.create('Temp');
        const keep = playlists.create('Keep');
        await videos.addFromText('dQw4w9WgXcQ 9bZkp7q19f0', p.id);
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

    it('creates a playlist from a YouTube playlist link with its titles', async () => {
        const created = await playlists.createFromInput(`https://www.youtube.com/playlist?list=${LIST}`);
        expect(created.name).toBe('Road trip');
        expect(created.description).toBe('Imported from YouTube (Juan)');
        expect(playlists.selectedId).toBe(created.id);
        expect(videos.forPlaylist(created.id).map((v) => [v.youtubeId, v.title, v.author])).toEqual([
            ['dQw4w9WgXcQ', 'Never Gonna Give You Up', 'Rick Astley'],
            ['kJQP7kiw5Fk', 'Despacito', 'Luis Fonsi'],
        ]);
        expect(ui.notices.at(-1).message).toBe(
            'Imported “Road trip” with 2 videos. 1 private or deleted video left out',
        );
        expect(playlists.importing).toBe(false);

        // A plain name still creates an empty playlist.
        const named = await playlists.createFromInput('Cooking');
        expect(named.name).toBe('Cooking');
        expect(videos.forPlaylist(named.id)).toEqual([]);
    });

    it('reports a private playlist without creating anything', async () => {
        const before = playlists.items.length;
        expect(
            await playlists.createFromInput('https://www.youtube.com/playlist?list=PLprivateprivateprivate'),
        ).toBeNull();
        expect(playlists.items).toHaveLength(before);
        expect(ui.notices.at(-1)).toMatchObject({ tone: 'error', message: 'Playlist not found, or it is private' });
    });

    it('adds a playlist link’s videos to the open playlist and notes partial imports', async () => {
        const p = playlists.create('Mixed');
        expect(await videos.addFromText(`dQw4w9WgXcQ PLpartialpartialpartial ${LIST}`, p.id)).toBe(true);
        expect(videos.forPlaylist(p.id).map((v) => v.youtubeId)).toEqual(['dQw4w9WgXcQ', '9bZkp7q19f0', 'kJQP7kiw5Fk']);
        const message = ui.notices.at(-1).message;
        expect(message).toContain('Added 3 videos. 1 video already in this playlist');
        expect(message).toContain('YOUTUBE_API_KEY');
    });
});
