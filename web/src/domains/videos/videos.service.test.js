import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import initSqlJs from 'sql.js';
import { Database } from '../../core/db/database.js';
import { setDatabase } from '../../core/db/index.js';
import { onDataChanged } from '../../core/events.js';
import { playlists } from '../playlists/playlists.service.svelte.js';
import { ui } from '../ui/ui.service.svelte.js';
import { videos } from './videos.service.svelte.js';
import * as repo from './videos.repository.js';

let SQL;
beforeAll(async () => {
    SQL = await initSqlJs();
    // No network in tests: metadata lookups fail, playlist imports are served from fixtures.
    globalThis.fetch = async (url) => {
        const match = String(url).match(/\/api\/playlist\?id=([^&]+)/);
        const playlist = match && PLAYLISTS[decodeURIComponent(match[1])];
        // Like the API: deleted videos come back in their place only when asked for.
        if (playlist && /[?&]includeUnavailable=true/.test(String(url)) && playlist.withDeleted) {
            return { ok: true, status: 200, json: async () => playlist.withDeleted };
        }
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
        withDeleted: {
            id: LIST,
            title: 'Road trip',
            author: 'Juan',
            skipped: 0,
            partial: false,
            source: 'api',
            videos: [
                { youtubeId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', author: 'Rick Astley', thumbnailUrl: '' },
                { youtubeId: 'aaaaaaaaaaa', title: 'Deleted video', author: '', thumbnailUrl: '', unavailable: true },
                { youtubeId: 'kJQP7kiw5Fk', title: 'Despacito', author: 'Luis Fonsi', thumbnailUrl: '' },
            ],
        },
    },
    // The same playlist some time later, as /api/playlist returns it with deleted videos.
    PLlaterlaterlaterlater: {
        id: 'PLlaterlaterlaterlater',
        title: 'Road trip',
        author: 'Juan',
        skipped: 0,
        partial: false,
        source: 'api',
        videos: [
            { youtubeId: 'dQw4w9WgXcQ', title: 'Deleted video', author: '', thumbnailUrl: '', unavailable: true },
            { youtubeId: '9bZkp7q19f0', title: 'Gangnam Style', author: 'PSY', thumbnailUrl: '' },
            { youtubeId: 'fJ9rUzIMcZQ', title: 'Queen - Bohemian Rhapsody', author: 'Queen', thumbnailUrl: '' },
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
        expect(created).toMatchObject({ source: 'youtube', sourceId: LIST });

        // A plain name still creates an empty playlist.
        const named = await playlists.createFromInput('Cooking');
        expect(named.name).toBe('Cooking');
        expect(videos.forPlaylist(named.id)).toEqual([]);
    });

    it('imports deleted videos as Missing items in their place when asked, and completes them with a new link', async () => {
        const created = await playlists.createFromInput(`https://www.youtube.com/playlist?list=${LIST}`, {
            includeUnavailable: true,
        });
        const list = videos.forPlaylist(created.id);
        expect(list.map((v) => [v.youtubeId, v.title, v.unavailable, v.missing])).toEqual([
            ['dQw4w9WgXcQ', 'Never Gonna Give You Up', false, false],
            ['aaaaaaaaaaa', 'Deleted video', true, true],
            ['kJQP7kiw5Fk', 'Despacito', false, false],
        ]);
        expect(ui.notices.at(-1).message).toBe(
            'Imported “Road trip” with 2 videos. 1 deleted or private video added as Missing',
        );

        // It can't be played, shows under Missing, and keeps its ID until a new link replaces it.
        const deleted = list[1];
        videos.play(deleted.id);
        expect(videos.playingId).toBeNull();
        videos.setFilter('missing');
        expect(videos.visibleFor(created.id).map((v) => v.id)).toEqual([deleted.id]);
        expect(await videos.complete(deleted.id, 'https://youtu.be/9bZkp7q19f0')).toBe(true);
        expect(videos.forPlaylist(created.id)[1]).toMatchObject({
            youtubeId: '9bZkp7q19f0',
            unavailable: false,
            missing: false,
        });
    });

    it('links a playlist to its YouTube playlist, and unlinks it', () => {
        const p = playlists.create('Imported long ago');
        expect(p).toMatchObject({ source: '', sourceId: '' });

        expect(playlists.linkToYouTube(p.id, 'not a link')).toBe(false);
        expect(ui.notices.at(-1).tone).toBe('error');
        expect(playlists.linkToYouTube(p.id, `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${LIST}`)).toBe(true);
        expect(playlists.selected).toMatchObject({ source: 'youtube', sourceId: LIST });

        expect(playlists.linkToYouTube(p.id, '  ')).toBe(true);
        expect(playlists.selected).toMatchObject({ source: '', sourceId: '' });
    });

    it('syncs a playlist from YouTube: adds new videos, marks deleted ones, and removes only when asked', async () => {
        const p = playlists.create('Road trip');
        videos.addEntries(p.id, [
            { youtubeId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', author: 'Rick Astley' },
            { youtubeId: 'kJQP7kiw5Fk', title: 'Despacito', author: 'Luis Fonsi' },
            { youtubeId: '9bZkp7q19f0', title: 'Gangnam Style', author: 'PSY' },
        ]);
        expect(await playlists.readLinkedYouTubePlaylist(p.id)).toBeNull();
        playlists.linkToYouTube(p.id, 'PLlaterlaterlaterlater');

        const source = await playlists.readLinkedYouTubePlaylist(p.id);
        const diff = playlists.compareWithYouTube(p.id, source);
        expect(diff.added.map((a) => [a.youtubeId, a.afterId])).toEqual([
            ['fJ9rUzIMcZQ', videos.forPlaylist(p.id)[2].id],
        ]);
        expect(diff.nowUnavailable.map((v) => v.youtubeId)).toEqual(['dQw4w9WgXcQ']);
        expect(diff.removed.map((v) => v.youtubeId)).toEqual(['kJQP7kiw5Fk']);

        playlists.applyYouTubeSync(p.id, diff);
        expect(videos.forPlaylist(p.id).map((v) => [v.youtubeId, v.title, v.unavailable])).toEqual([
            // A deleted video keeps the title it had here, not YouTube's "Deleted video".
            ['dQw4w9WgXcQ', 'Never Gonna Give You Up', true],
            ['kJQP7kiw5Fk', 'Despacito', false],
            ['9bZkp7q19f0', 'Gangnam Style', false],
            ['fJ9rUzIMcZQ', 'Queen - Bohemian Rhapsody', false],
        ]);
        expect(videos.forPlaylist(p.id)[3]).toMatchObject({ artist: 'Queen', artistSource: 'guess' });
        expect(ui.notices.at(-1).message).toBe(
            'Synced with YouTube: 1 new video added, 1 marked as deleted on YouTube',
        );

        // Syncing again finds only the removal, and removes it when asked; nothing is added twice.
        const again = playlists.compareWithYouTube(p.id, source);
        expect(again).toMatchObject({ added: [], nowUnavailable: [] });
        playlists.applyYouTubeSync(p.id, again, { removeMissing: true });
        expect(videos.forPlaylist(p.id).map((v) => v.youtubeId)).toEqual(['dQw4w9WgXcQ', '9bZkp7q19f0', 'fJ9rUzIMcZQ']);
        expect(ui.notices.at(-1).message).toBe('Synced with YouTube: 1 removed');
    });

    it('says when deleted videos can’t be read without an API key', async () => {
        await playlists.createFromInput('PLpartialpartialpartial', { includeUnavailable: true });
        expect(ui.notices.at(-1).message).toContain('YOUTUBE_API_KEY');
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

    it('adds just the video of a watch link played from a playlist, or the whole playlist when asked', async () => {
        const link = `https://www.youtube.com/watch?v=9bZkp7q19f0&list=${LIST}`;
        const p = playlists.create('Choices');
        expect(await videos.addFromText(link, p.id)).toBe(true);
        expect(videos.forPlaylist(p.id).map((v) => v.youtubeId)).toEqual(['9bZkp7q19f0']);
        expect(await videos.addFromText(link, p.id, { wholePlaylists: true })).toBe(true);
        expect(videos.forPlaylist(p.id).map((v) => v.youtubeId)).toEqual(['9bZkp7q19f0', 'dQw4w9WgXcQ', 'kJQP7kiw5Fk']);
    });

    it('imports the playlist of a watch link, or starts with just its video when asked', async () => {
        const link = `https://www.youtube.com/watch?v=9bZkp7q19f0&list=${LIST}`;
        const imported = await playlists.createFromInput(link);
        expect(imported.name).toBe('Road trip');
        const single = await playlists.createFromInput(link, { justVideo: true });
        expect(single.sourceId ?? '').toBe('');
        expect(videos.forPlaylist(single.id).map((v) => v.youtubeId)).toEqual(['9bZkp7q19f0']);
    });

    it('starts a playlist with just the video of a Mix link, and refuses private lists', async () => {
        const mix = await playlists.createFromInput(
            'https://www.youtube.com/watch?v=CMZRJb1jxzE&list=RDCMZRJb1jxzE&start_radio=1',
        );
        expect(videos.forPlaylist(mix.id).map((v) => v.youtubeId)).toEqual(['CMZRJb1jxzE']);
        expect(ui.notices.at(-1).message).toContain('Mixes can’t be imported');

        const before = playlists.items.length;
        expect(await playlists.createFromInput('https://www.youtube.com/playlist?list=WL')).toBeNull();
        expect(playlists.items).toHaveLength(before);
        expect(ui.notices.at(-1)).toMatchObject({ tone: 'error' });
    });

    it('puts back items missing since an old report, in their old place', async () => {
        const p = playlists.create('City Pop');
        videos.addEntries(p.id, [
            { youtubeId: 'dQw4w9WgXcQ', title: 'Anri - Windy Summer' },
            { youtubeId: 'kJQP7kiw5Fk', title: 'Tomoko Aran - Midnight Pretenders' },
        ]);
        const report = [
            'Total videos: 5',
            '1: Mariya Takeuchi - Plastic Love',
            '2: Anri - Windy Summer',
            '3: Miki Matsubara - Mayonaka no Door',
            '4: https://youtu.be/9bZkp7q19f0',
            '5: Tomoko Aran - Midnight Pretenders',
        ].join('\r\n');

        const comparison = playlists.compareWithReport(p.id, report);
        expect(comparison).toMatchObject({ total: 5, found: 2 });
        playlists.addMissingFromReport(p.id, comparison.missing);

        const list = videos.forPlaylist(p.id);
        expect(list.map((v) => v.title || v.youtubeId)).toEqual([
            'Mariya Takeuchi - Plastic Love',
            'Anri - Windy Summer',
            'Miki Matsubara - Mayonaka no Door',
            '9bZkp7q19f0',
            'Tomoko Aran - Midnight Pretenders',
        ]);
        expect(list.map((v) => v.missing)).toEqual([true, false, true, false, false]);
        expect(ui.notices.at(-1).message).toBe('Added 3 missing items. 2 need a YouTube link');
        expect(videos.filter).toBe('missing');
        expect(videos.visibleFor(p.id)).toHaveLength(2);

        // Comparing again finds nothing new: placeholders count as present.
        expect(playlists.compareWithReport(p.id, report).missing).toEqual([]);
    });

    it('completes a placeholder with a pasted link and skips placeholders when playing', async () => {
        const p = playlists.create('City Pop');
        videos.addEntries(p.id, [{ youtubeId: 'dQw4w9WgXcQ', title: 'First' }]);
        const [placeholder] = videos.addFromReport(p.id, [
            { number: 2, title: 'Plastic Love', youtubeId: null, afterId: videos.forPlaylist(p.id)[0].id },
        ]);
        videos.addEntries(p.id, [{ youtubeId: 'kJQP7kiw5Fk', title: 'Third' }]);

        const [first, , third] = videos.forPlaylist(p.id);
        videos.play(placeholder.id);
        expect(videos.playingId).toBeNull();
        videos.play(first.id);
        videos.finishAndPlayNext();
        expect(videos.playingId).toBe(third.id);

        expect(await videos.complete(placeholder.id, 'not a link')).toBe(false);
        expect(await videos.complete(placeholder.id, 'https://youtu.be/kJQP7kiw5Fk')).toBe(false);
        expect(ui.notices.at(-1).message).toContain('already in this playlist');

        // No network in tests, so the report title stays and only the link is filled in.
        expect(await videos.complete(placeholder.id, 'https://www.youtube.com/watch?v=9bZkp7q19f0&t=3s')).toBe(true);
        const done = videos.forPlaylist(p.id)[1];
        expect(done).toMatchObject({
            id: placeholder.id,
            youtubeId: '9bZkp7q19f0',
            missing: false,
            title: 'Plastic Love',
        });
        expect(done.thumbnailUrl).toContain('9bZkp7q19f0');
    });

    it('guesses artists when adding, keeps hand edits and searches by artist', () => {
        const p = playlists.create('City Pop');
        videos.addEntries(p.id, [
            { youtubeId: 'dQw4w9WgXcQ', title: 'Meiko Nakahara - Dance in the memories', author: 'Jim Gutierrez' },
            { youtubeId: '9bZkp7q19f0', title: 'Windy Summer', author: 'Anri - Topic' },
            { youtubeId: 'kJQP7kiw5Fk', title: 'Untitled live recording', author: 'Raven Almazan' },
        ]);
        const [meiko, anri, untitled] = videos.forPlaylist(p.id);
        expect([meiko, anri, untitled].map((v) => [v.artist, v.artistSource])).toEqual([
            ['Meiko Nakahara', 'guess'],
            ['Anri', 'guess'],
            ['', ''],
        ]);

        videos.saveArtist(untitled.id, '  Tatsuro | Yamashita ');
        videos.saveArtist(meiko.id, '');
        videos.load();
        expect(videos.forPlaylist(p.id).map((v) => [v.artist, v.artistSource])).toEqual([
            ['', 'user'],
            ['Anri', 'guess'],
            ['Tatsuro / Yamashita', 'user'],
        ]);

        videos.setQuery('tatsuro');
        expect(videos.visibleFor(p.id).map((v) => v.id)).toEqual([untitled.id]);

        // An artist another video has keeps its spelling; a video can still fix its own.
        expect(videos.saveArtist(meiko.id, 'ANRI').artist).toBe('Anri');
        expect(videos.saveArtist(untitled.id, 'tatsuro / yamashita').artist).toBe('tatsuro / yamashita');
        expect(videos.artists).toEqual(['Anri', 'tatsuro / yamashita']);
    });

    it('guesses the artist once for videos saved before artists existed', () => {
        const db = new Database(new SQL.Database());
        setDatabase(db);
        const p = playlists.create('Old');
        videos.addEntries(p.id, [{ youtubeId: 'dQw4w9WgXcQ', title: 'Anri - Windy Summer' }]);
        const [video] = videos.forPlaylist(p.id);
        repo.updateVideo(db, video.id, { artist: '', artistSource: '' });

        videos.load();
        expect(videos.forPlaylist(p.id)[0]).toMatchObject({ artist: 'Anri', artistSource: 'guess' });
    });

    it('restores missing items with the report’s artist, or a guess for legacy reports', () => {
        const p = playlists.create('City Pop');
        videos.addEntries(p.id, [{ youtubeId: 'dQw4w9WgXcQ', title: 'Kept' }]);
        const withArtists = 'Format: number: title | artist\n1: Kept |\n2: Plastic Love | Mariya Takeuchi';
        playlists.addMissingFromReport(p.id, playlists.compareWithReport(p.id, withArtists).missing);
        playlists.addMissingFromReport(
            p.id,
            playlists.compareWithReport(p.id, '1: Kept\n2: Plastic Love\n3: Anri - Windy Summer').missing,
        );

        expect(videos.forPlaylist(p.id).map((v) => [v.title, v.artist, v.artistSource])).toEqual([
            ['Kept', '', ''],
            ['Plastic Love', 'Mariya Takeuchi', 'user'],
            ['Anri - Windy Summer', 'Anri', 'guess'],
        ]);
    });
});
