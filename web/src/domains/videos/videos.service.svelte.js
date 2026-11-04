import { getDatabase } from '../../core/db/index.js';
import { getApiBase } from '../../core/config.js';
import { dataChanged } from '../../core/events.js';
import { notify } from '../ui/ui.service.svelte.js';
import { extractYouTubeIds, parseYouTubeId, thumbnailFor } from './youtube.js';
import { cleanArtist, guessedArtistPatch, knownArtists, matchKnownArtist } from './artist.js';
import { fetchVideoMetadata } from './metadata.client.js';
import { fetchYouTubePlaylist } from './playlist.client.js';
import * as repo from './videos.repository.js';

const byPosition = (a, b) => a.position - b.position;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Shown when YouTube only returned part of a playlist (no API key on the server). */
export const PARTIAL_IMPORT_NOTE =
    'Only the latest videos could be read. Set YOUTUBE_API_KEY on the API to import whole playlists.';

/**
 * Application layer for videos: holds the reactive list the components
 * render and the use cases that change it. Every write goes through the
 * repository (SQLite) first, then updates the in-memory state.
 */
class VideosService {
    items = $state([]);
    filter = $state('all'); // 'all' | 'unwatched' | 'watched' | 'missing'
    query = $state('');
    playingId = $state(null);
    importing = $state(false);

    /** { [playlistId]: { total, watched } } for the sidebar. */
    counts = $derived.by(() => {
        const counts = {};
        for (const v of this.items) {
            const c = (counts[v.playlistId] ??= { total: 0, watched: 0 });
            c.total++;
            if (v.watched) c.watched++;
        }
        return counts;
    });

    /** Every artist in the library, most used first: suggestions when editing one. */
    artists = $derived(knownArtists(this.items));

    playing = $derived(this.playingId ? (this.items.find((v) => v.id === this.playingId) ?? null) : null);

    // ---- queries -------------------------------------------------------

    /** Every video of a playlist, in order. */
    forPlaylist(playlistId) {
        return this.items.filter((v) => v.playlistId === playlistId).sort(byPosition);
    }

    /** Videos of a playlist after the current filter and search. */
    visibleFor(playlistId) {
        const q = this.query.trim().toLowerCase();
        return this.forPlaylist(playlistId)
            .filter((v) => {
                if (this.filter === 'watched') return v.watched;
                if (this.filter === 'unwatched') return !v.watched;
                if (this.filter === 'missing') return v.missing;
                return true;
            })
            .filter(
                (v) =>
                    !q ||
                    v.title.toLowerCase().includes(q) ||
                    v.artist.toLowerCase().includes(q) ||
                    v.author.toLowerCase().includes(q) ||
                    v.notes.toLowerCase().includes(q),
            );
    }

    // ---- use cases -----------------------------------------------------

    load() {
        this.items = repo.listVideos(getDatabase());
        if (this.playingId && !this.items.some((v) => v.id === this.playingId)) this.playingId = null;
        this.#guessMissingArtists();
    }

    /**
     * Adds every YouTube link found in `text`: video links add that video, and
     * playlist links add all of the playlist's videos. Plain video links show up
     * at once and get their titles as they load.
     * Resolves to true when at least one video was added.
     */
    async addFromText(text, playlistId, { wholePlaylists = false } = {}) {
        if (!playlistId) {
            notify('Create a playlist first', { tone: 'error' });
            return false;
        }
        const { ids, playlistIds, invalid } = extractYouTubeIds(text, { wholePlaylists });
        if (!ids.length && !playlistIds.length) {
            notify('That doesn’t look like a YouTube link', { tone: 'error' });
            return false;
        }

        const entries = [...ids];
        const failures = [];
        let partial = false;
        if (playlistIds.length) {
            this.importing = true;
            try {
                for (const listId of playlistIds) {
                    try {
                        const playlist = await fetchYouTubePlaylist(listId, getApiBase());
                        entries.push(...playlist.videos);
                        partial ||= playlist.partial;
                    } catch (err) {
                        failures.push(err.message);
                    }
                }
            } finally {
                this.importing = false;
            }
        }
        if (!entries.length) {
            notify(failures[0] ?? 'That playlist has no videos to add', { tone: 'error' });
            return false;
        }

        const { added, skipped } = this.addEntries(playlistId, entries);
        const parts = [];
        if (added.length) parts.push(`Added ${plural(added.length, 'video')}`);
        if (skipped.length) parts.push(`${plural(skipped.length, 'video')} already in this playlist`);
        if (invalid.length) parts.push(`${plural(invalid.length, 'link')} skipped`);
        if (failures.length) parts.push(failures[0]);
        if (partial) parts.push(PARTIAL_IMPORT_NOTE);
        notify(parts.join('. '), {
            tone: added.length ? 'info' : 'error',
            timeout: partial || failures.length ? 8000 : 4000,
        });
        return added.length > 0;
    }

    /**
     * Appends videos (YouTube IDs, or objects with youtubeId/title/author/thumbnailUrl)
     * to a playlist and fetches titles for the ones that came without one.
     */
    addEntries(playlistId, entries) {
        const withArtists = entries.map((entry) =>
            typeof entry === 'string' ? entry : { ...entry, ...guessedArtistPatch(entry) },
        );
        const result = repo.addVideos(getDatabase(), playlistId, withArtists);
        if (result.added.length) {
            this.items = [...this.items, ...result.added];
            dataChanged();
        }
        this.enrichMetadata(result.added.filter((v) => !v.title));
        return result;
    }

    /**
     * Puts back entries missing since an old report (see playlists/report-compare.js)
     * near their old place. Entries with a YouTube link become videos; the rest
     * become placeholders that wait for a link. An entry's `artist` comes from
     * a report with artists; for older reports it's guessed from the title.
     * Returns the inserted videos.
     */
    addFromReport(playlistId, missing) {
        const entries = missing.map((entry) => {
            // A link stands in for an unknown title; YouTube's title replaces it below.
            const title = entry.youtubeId ? '' : entry.title;
            const artist = entry.artist
                ? { artist: cleanArtist(entry.artist), artistSource: 'user' }
                : guessedArtistPatch({ title, author: '', artist: '', artistSource: '' });
            return { youtubeId: entry.youtubeId ?? '', title, afterId: entry.afterId, ...artist };
        });
        const added = repo.insertVideosAfter(getDatabase(), playlistId, entries);
        if (added.length) {
            this.items = [...this.items, ...added];
            dataChanged();
        }
        this.enrichMetadata(added.filter((v) => !v.missing && !v.title));
        return added;
    }

    /**
     * Completes a placeholder, or a video deleted on YouTube, with the YouTube
     * video at `link`: its ID, then the title, channel and thumbnail from YouTube.
     * Resolves to true when saved.
     */
    async complete(id, link) {
        const video = repo.getVideo(getDatabase(), id);
        if (!video) return false;
        const youtubeId = parseYouTubeId(link.trim());
        if (!youtubeId) {
            notify('Paste a YouTube video link, like https://youtu.be/…', { tone: 'error' });
            return false;
        }
        const duplicate = this.items.find(
            (v) => v.playlistId === video.playlistId && v.youtubeId === youtubeId && v.id !== id,
        );
        if (duplicate) {
            notify(`That video is already in this playlist: “${duplicate.title || youtubeId}”`, { tone: 'error' });
            return false;
        }
        this.#update(id, { youtubeId, thumbnailUrl: thumbnailFor(youtubeId), unavailable: false });
        const meta = await fetchVideoMetadata(youtubeId, getApiBase());
        const current = repo.getVideo(getDatabase(), id);
        if (meta && !meta.unavailable && current?.youtubeId === youtubeId) {
            this.#update(id, { ...meta, ...guessedArtistPatch(current, meta) });
        }
        return true;
    }

    /** Fetches titles for videos that don't have one yet, three at a time. */
    async enrichMetadata(videos = this.items.filter((v) => !v.title && !v.missing)) {
        const queue = [...videos];
        const worker = async () => {
            while (queue.length) {
                const video = queue.shift();
                const meta = await fetchVideoMetadata(video.youtubeId, getApiBase());
                if (!meta || meta.unavailable) continue;
                const current = repo.getVideo(getDatabase(), video.id);
                if (!current || current.title) continue;
                this.#update(video.id, { ...meta, ...guessedArtistPatch(current, meta) });
            }
        };
        await Promise.all([worker(), worker(), worker()]);
    }

    setWatched(id, watched) {
        return this.#update(id, { watched });
    }

    saveNotes(id, notes) {
        return this.#update(id, { notes: notes.slice(0, 5000) });
    }

    /**
     * A hand edit wins over any guess or lookup, even when it clears the artist.
     * An artist other videos already have keeps their spelling ("tomoko aran"
     * becomes "Tomoko Aran"); the edited video itself doesn't count, so fixing
     * its own spelling works.
     */
    saveArtist(id, artist) {
        const known = knownArtists(this.items.filter((v) => v.id !== id));
        return this.#update(id, { artist: matchKnownArtist(artist, known), artistSource: 'user' });
    }

    /** Moves a video to a new index in its playlist's full order. */
    reorder(id, toIndex) {
        const video = repo.reorderVideo(getDatabase(), id, toIndex);
        if (video) this.#replace(video);
    }

    moveToPlaylist(id, playlist) {
        const { video, duplicate } = repo.moveVideoToPlaylist(getDatabase(), id, playlist.id);
        if (duplicate) {
            notify('That video is already in the other playlist', { tone: 'error' });
            return;
        }
        if (!video) return;
        this.#replace(video);
        notify(`Moved to “${playlist.name}”`);
    }

    remove(id) {
        const video = repo.getVideo(getDatabase(), id);
        if (!video) return;
        repo.deleteVideo(getDatabase(), id);
        this.items = this.items.filter((v) => v.id !== id);
        if (this.playingId === id) this.playingId = null;
        dataChanged();
        notify(video.title ? `Removed “${video.title}”` : 'Removed the video', {
            timeout: 6000,
            undo: () => this.restore(id),
        });
    }

    restore(id) {
        const video = repo.restoreVideo(getDatabase(), id);
        if (video) this.#replace(video);
    }

    /**
     * Applies a comparison with the playlist's YouTube playlist (see
     * playlists/youtube-sync.js) in one transaction: adds the new videos in
     * YouTube's order, marks or unmarks videos deleted on YouTube, and, with
     * `removeMissing`, removes the videos no longer in the YouTube playlist.
     * Returns how many of each changed.
     */
    applyYouTubeSync(playlistId, diff, { removeMissing = false } = {}) {
        const db = getDatabase();
        const removed = removeMissing ? diff.removed : [];
        const added = db.transaction(() => {
            const inserted = repo.insertVideosAfter(
                db,
                playlistId,
                diff.added.map((entry) => ({ ...entry, ...guessedArtistPatch(entry) })),
            );
            for (const video of diff.nowUnavailable) repo.updateVideo(db, video.id, { unavailable: true });
            for (const video of diff.availableAgain) repo.updateVideo(db, video.id, { unavailable: false });
            for (const video of removed) repo.deleteVideo(db, video.id);
            return inserted;
        });
        // Reloading also stops the player when the video playing was removed.
        this.load();
        dataChanged();
        return {
            added: added.filter((v) => !v.unavailable).length,
            addedMissing: added.filter((v) => v.unavailable).length,
            nowUnavailable: diff.nowUnavailable.length,
            availableAgain: diff.availableAgain.length,
            removed: removed.length,
        };
    }

    /** Forgets a deleted playlist's videos (the repository already removed them). */
    dropPlaylist(playlistId) {
        this.items = this.items.filter((v) => v.playlistId !== playlistId);
        if (this.playingId && !this.items.some((v) => v.id === this.playingId)) this.playingId = null;
    }

    setFilter(filter) {
        this.filter = filter;
    }

    setQuery(query) {
        this.query = query;
    }

    play(id) {
        if (this.items.find((v) => v.id === id)?.missing) return;
        this.playingId = id;
    }

    closePlayer() {
        this.playingId = null;
    }

    /** Marks the playing video watched and starts the next unwatched one. */
    finishAndPlayNext() {
        const current = this.playing;
        if (!current) return;
        this.setWatched(current.id, true);
        const queue = this.forPlaylist(current.playlistId);
        const playable = (v) => !v.watched && !v.missing;
        const next = queue.find((v) => v.position > current.position && playable(v)) ?? queue.find(playable);
        if (next) this.play(next.id);
        else {
            this.closePlayer();
            notify('You’ve watched everything in this playlist');
        }
    }

    // ---- helpers -------------------------------------------------------

    /**
     * Guesses the artist of videos that have never had one, such as videos
     * saved before artists existed. A video keeps its source once it has an
     * artist, so each one is only guessed once.
     */
    #guessMissingArtists() {
        const guesses = this.items
            .filter((v) => !v.artistSource)
            .map((v) => ({ id: v.id, ...guessedArtistPatch(v) }))
            .filter((g) => g.artist);
        if (!guesses.length) return;
        const db = getDatabase();
        const updated = db.transaction(() => guesses.map(({ id, ...patch }) => repo.updateVideo(db, id, patch)));
        const byId = new Map(updated.filter(Boolean).map((v) => [v.id, v]));
        this.items = this.items.map((v) => byId.get(v.id) ?? v);
        dataChanged();
    }

    #update(id, patch) {
        const video = repo.updateVideo(getDatabase(), id, patch);
        if (video) this.#replace(video);
        return video;
    }

    #replace(video) {
        const exists = this.items.some((v) => v.id === video.id);
        this.items = exists ? this.items.map((v) => (v.id === video.id ? video : v)) : [...this.items, video];
        dataChanged();
    }
}

export const videos = new VideosService();
