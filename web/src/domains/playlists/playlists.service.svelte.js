import { getDatabase } from '../../core/db/index.js';
import { dataChanged } from '../../core/events.js';
import { notify } from '../ui/ui.service.svelte.js';
import { getApiBase } from '../../core/config.js';
import { videos, PARTIAL_IMPORT_NOTE } from '../videos/videos.service.svelte.js';
import { parsePlaylistId } from '../videos/youtube.js';
import { fetchYouTubePlaylist } from '../videos/playlist.client.js';
import { downloadTextFile } from '../../shared/download.js';
import { buildPlaylistReport, reportFileName } from './report.js';
import * as repo from './playlists.repository.js';

const LAST_SELECTED_KEY = 'ytpm:selectedPlaylist';

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

    create(name, description = '') {
        try {
            const playlist = repo.createPlaylist(getDatabase(), { name, description });
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
     * playlist link (then the playlist's title and videos are imported).
     * Resolves to the new playlist, or null when nothing was created.
     */
    async createFromInput(input) {
        const listId = parsePlaylistId(input);
        return listId ? this.importFromYouTube(listId) : this.create(input);
    }

    /** Creates a playlist with the title and videos of a public YouTube playlist. */
    async importFromYouTube(listId) {
        this.importing = true;
        try {
            const source = await fetchYouTubePlaylist(listId, getApiBase());
            const name = source.title?.trim() || 'YouTube playlist';
            const description = source.author ? `Imported from YouTube (${source.author})` : 'Imported from YouTube';
            const playlist = this.create(name, description);
            if (!playlist) return null;
            const { added } = videos.addEntries(playlist.id, source.videos);
            const parts = [`Imported “${playlist.name}” with ${added.length} video${added.length === 1 ? '' : 's'}`];
            if (source.skipped)
                parts.push(`${source.skipped} private or deleted video${source.skipped === 1 ? '' : 's'} left out`);
            if (source.partial) parts.push(PARTIAL_IMPORT_NOTE);
            notify(parts.join('. '), { timeout: source.partial ? 8000 : 4000 });
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

    /** Downloads a numbered list of the playlist's videos as a .txt file. */
    downloadReport(id) {
        const playlist = this.items.find((p) => p.id === id);
        if (!playlist) return;
        const fileName = reportFileName(playlist.name);
        downloadTextFile(fileName, buildPlaylistReport(videos.forPlaylist(id)));
        notify(`Saved ${fileName}`);
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
        } catch (err) {
            notify(err.message, { tone: 'error' });
        }
    }
}

export const playlists = new PlaylistsService();
