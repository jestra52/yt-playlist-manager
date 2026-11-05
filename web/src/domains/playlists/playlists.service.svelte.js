import { getDatabase } from '@ytpm/core/db/index';
import { dataChanged } from '../../core/events.js';
import { notify } from '../ui/ui.service.svelte.js';
import { getApiBase } from '../../core/config.js';
import { videos, PARTIAL_IMPORT_NOTE } from '../videos/videos.service.svelte.js';
import {
    listProblem,
    parsePlaylistId,
    parseYouTubeId,
    parseYouTubeList,
    videoInPlaylist,
} from '@ytpm/core/videos/youtube';
import { fetchYouTubePlaylist } from '@ytpm/core/videos/playlist.client';
import { fetchVideoMetadata } from '@ytpm/core/videos/metadata.client';
import { downloadTextFile } from '../../shared/download.js';
import { buildPlaylistReport, reportFileName } from '@ytpm/core/playlists/report';
import { compareReport, parseReport } from '@ytpm/core/playlists/report-compare';
import { diffWithYouTube } from '@ytpm/core/playlists/youtube-sync';
import * as repo from '@ytpm/core/playlists/playlists.repository';

const LAST_SELECTED_KEY = 'ytpm:selectedPlaylist';

/** YouTube only lists deleted and private videos to the Data API, which needs a key. */
export const UNAVAILABLE_NEEDS_KEY_NOTE = 'Deleted videos can only be imported when YOUTUBE_API_KEY is set on the API';

const remember = (id) => {
    try {
        if (id) localStorage.setItem(LAST_SELECTED_KEY, id);
    } catch {
        /* storage unavailable: the selection just isn't remembered */
    }
};

const recall = () => {
    try {
        return localStorage.getItem(LAST_SELECTED_KEY);
    } catch {
        return null;
    }
};

/** Application layer for playlists: reactive list + selection + use cases. */
class PlaylistsService {
    items = $state([]);
    selectedId = $state(null);
    importing = $state(false);

    selected = $derived(this.items.find((p) => p.id === this.selectedId) ?? null);

    load() {
        this.items = repo.listPlaylists(getDatabase());
        const preferred = this.selectedId ?? recall();
        this.selectedId = this.items.some((p) => p.id === preferred) ? preferred : (this.items[0]?.id ?? null);
    }

    select(id) {
        this.selectedId = id;
        remember(id);
    }

    create(name, description = '', source = {}) {
        try {
            const playlist = repo.createPlaylist(getDatabase(), { name, description, ...source });
            this.items = [...this.items, playlist];
            this.select(playlist.id);
            dataChanged();
            return playlist;
        } catch (err) {
            notify(err.message, { tone: 'error' });
            return null;
        }
    }

    /**
     * Creates a playlist from what the person typed: a name, or a YouTube
     * playlist link (then the playlist's title and videos are imported; see
     * importFromYouTube for `options`).
     * Resolves to the new playlist, or null when nothing was created.
     */
    async createFromInput(input, { justVideo = false, ...options } = {}) {
        const fromList = justVideo ? videoInPlaylist(input) : null;
        if (fromList) return this.createFromVideo(fromList.id);
        const listId = parsePlaylistId(input);
        if (listId) return this.importFromYouTube(listId, options);
        const problem = listProblem(input);
        if (!problem) return this.create(input);
        const videoId = parseYouTubeList(input)?.kind === 'mix' ? parseYouTubeId(input) : null;
        if (!videoId) {
            notify(problem, { tone: 'error', timeout: 6000 });
            return null;
        }
        const playlist = await this.createFromVideo(videoId);
        if (playlist) notify("YouTube Mixes can't be imported, so only this video was added", { timeout: 6000 });
        return playlist;
    }

    async createFromVideo(youtubeId) {
        this.importing = true;
        try {
            const meta = await fetchVideoMetadata(youtubeId, getApiBase());
            const playlist = this.create(meta?.title?.trim() || 'New playlist');
            if (playlist) videos.addEntries(playlist.id, [meta?.title ? { youtubeId, ...meta } : youtubeId]);
            return playlist;
        } finally {
            this.importing = false;
        }
    }

    /**
     * Creates a playlist with the title and videos of a public YouTube playlist,
     * and remembers where it came from. With `includeUnavailable`, its deleted
     * and private videos come in as Missing items in their place (they keep their
     * YouTube ID); otherwise they're left out.
     */
    async importFromYouTube(listId, { includeUnavailable = false } = {}) {
        this.importing = true;
        try {
            const source = await fetchYouTubePlaylist(listId, getApiBase(), { includeUnavailable });
            const name = source.title?.trim() || 'YouTube playlist';
            const description = source.author ? `Imported from YouTube (${source.author})` : 'Imported from YouTube';
            const playlist = this.create(name, description, { source: 'youtube', sourceId: listId });
            if (!playlist) return null;
            const { added } = videos.addEntries(playlist.id, source.videos);
            const gone = added.filter((v) => v.unavailable).length;
            const count = added.length - gone;
            const parts = [`Imported “${playlist.name}” with ${count} video${count === 1 ? '' : 's'}`];
            if (gone) parts.push(`${gone} deleted or private video${gone === 1 ? '' : 's'} added as Missing`);
            if (source.skipped)
                parts.push(`${source.skipped} private or deleted video${source.skipped === 1 ? '' : 's'} left out`);
            if (includeUnavailable && source.source !== 'api' && !source.partial)
                parts.push(UNAVAILABLE_NEEDS_KEY_NOTE);
            if (source.partial) parts.push(PARTIAL_IMPORT_NOTE);
            notify(parts.join('. '), { timeout: source.partial || gone ? 8000 : 4000 });
            return playlist;
        } catch (err) {
            notify(err.message, { tone: 'error', timeout: 6000 });
            return null;
        } finally {
            this.importing = false;
        }
    }

    rename(id, name) {
        this.#update(id, { name });
    }

    describe(id, description) {
        this.#update(id, { description });
    }

    /**
     * Links a playlist to the YouTube playlist at `input` (a link or a bare ID),
     * e.g. one imported before imports were remembered, so it can be synced
     * with it. An empty `input` unlinks it. Returns true when saved.
     */
    linkToYouTube(id, input) {
        const text = (input ?? '').trim();
        if (!text) {
            if (!this.#update(id, { source: '' })) return false;
            notify('Unlinked from YouTube');
            return true;
        }
        const listId = parsePlaylistId(text);
        if (!listId) {
            notify(listProblem(text) ?? 'Paste a YouTube playlist link, like https://www.youtube.com/playlist?list=…', {
                tone: 'error',
            });
            return false;
        }
        if (!this.#update(id, { source: 'youtube', sourceId: listId })) return false;
        notify('Linked to the YouTube playlist');
        return true;
    }

    /**
     * Reads the playlist's linked YouTube playlist, with its deleted and private
     * videos so they aren't mistaken for removed ones, without changing anything.
     * Resolves to the YouTube playlist (see playlist.client.js), or null after
     * telling the person what went wrong.
     */
    async readLinkedYouTubePlaylist(id) {
        const playlist = this.items.find((p) => p.id === id);
        if (playlist?.source !== 'youtube' || !playlist.sourceId) return null;
        try {
            return await fetchYouTubePlaylist(playlist.sourceId, getApiBase(), { includeUnavailable: true });
        } catch (err) {
            notify(err.message, { tone: 'error', timeout: 6000 });
            return null;
        }
    }

    /** Compares the playlist with a YouTube playlist read by readLinkedYouTubePlaylist. */
    compareWithYouTube(id, source, { includeUnavailable = false } = {}) {
        return diffWithYouTube(videos.forPlaylist(id), source, { includeUnavailable });
    }

    /**
     * Applies a comparison with YouTube. With `saveReport`, the playlist's report
     * is downloaded first, as it was before the sync (see #40 for automatic backups).
     */
    applyYouTubeSync(id, diff, { removeMissing = false, saveReport = false } = {}) {
        if (saveReport) this.downloadReport(id);
        const counts = videos.applyYouTubeSync(id, diff, { removeMissing });
        const parts = [];
        if (counts.added) parts.push(`${counts.added} new video${counts.added === 1 ? '' : 's'} added`);
        if (counts.addedMissing)
            parts.push(`${counts.addedMissing} deleted video${counts.addedMissing === 1 ? '' : 's'} added as Missing`);
        if (counts.nowUnavailable) parts.push(`${counts.nowUnavailable} marked as deleted on YouTube`);
        if (counts.availableAgain) parts.push(`${counts.availableAgain} back on YouTube`);
        if (counts.removed) parts.push(`${counts.removed} removed`);
        notify(parts.length ? `Synced with YouTube: ${parts.join(', ')}` : 'Already in step with YouTube', {
            timeout: 6000,
        });
        return counts;
    }

    /** Downloads a numbered list of the playlist's videos as a .txt file. */
    downloadReport(id) {
        const playlist = this.items.find((p) => p.id === id);
        if (!playlist) return;
        const fileName = reportFileName(playlist.name);
        downloadTextFile(fileName, buildPlaylistReport(videos.forPlaylist(id)));
        notify(`Saved ${fileName}`);
    }

    /**
     * Compares an old report's text with the playlist as it is now.
     * Returns { format, total, found, missing } (see report-compare.js), or null
     * when the text has no numbered lines.
     */
    compareWithReport(id, text) {
        const report = parseReport(text);
        if (!report.entries.length) return null;
        return compareReport(report, videos.forPlaylist(id));
    }

    /** Adds the entries a comparison found missing back to the playlist. */
    addMissingFromReport(id, missing) {
        const added = videos.addFromReport(id, missing);
        const waiting = added.filter((v) => v.missing).length;
        const parts = [`Added ${added.length} missing item${added.length === 1 ? '' : 's'}`];
        if (waiting) parts.push(`${waiting} need${waiting === 1 ? 's' : ''} a YouTube link`);
        notify(parts.join('. '));
        if (waiting) videos.setFilter('missing');
        return added;
    }

    /** Deletes the playlist and its videos (as tombstones, so it syncs). */
    remove(id) {
        const index = this.items.findIndex((p) => p.id === id);
        if (index === -1) return;
        const { name } = this.items[index];
        repo.deletePlaylist(getDatabase(), id);
        this.items = this.items.filter((p) => p.id !== id);
        videos.dropPlaylist(id);
        if (this.selectedId === id) this.select(this.items[Math.min(index, this.items.length - 1)]?.id ?? null);
        dataChanged();
        notify(`Deleted “${name}”`);
    }

    #update(id, patch) {
        try {
            const playlist = repo.updatePlaylist(getDatabase(), id, patch);
            this.items = this.items.map((p) => (p.id === id ? playlist : p));
            dataChanged();
            return playlist;
        } catch (err) {
            notify(err.message, { tone: 'error' });
            return null;
        }
    }
}

export const playlists = new PlaylistsService();
