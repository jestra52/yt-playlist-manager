import { getDatabase } from '@ytpm/core/db/index';
import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import type { MissingEntry } from '@ytpm/core/playlists/report-compare';
import type { YouTubeDiff } from '@ytpm/core/playlists/youtube-sync';
import { matchKnownArtist } from '@ytpm/core/videos/artist';
import {
    creditsPatch,
    guessedArtistPatch,
    knownCreditNames,
    newVideoArtistPatch,
    splitArtists,
    type ArtistCredit,
} from '@ytpm/core/videos/artist-credits';
import { fetchVideoMetadata } from '@ytpm/core/videos/metadata.client';
import { fetchYouTubePlaylist, PARTIAL_IMPORT_NOTE } from '@ytpm/core/videos/playlist.client';
import {
    addVideos,
    deleteVideo,
    getVideo,
    insertVideosAfter,
    listVideos,
    moveVideoToPlaylist,
    reorderVideo,
    replacedIdPatch,
    restoreVideo as restoreVideoRow,
    updateVideo,
    type Video,
    type VideoEntry,
} from '@ytpm/core/videos/videos.repository';
import { extractYouTubeIds, parseYouTubeId, thumbnailFor } from '@ytpm/core/videos/youtube';
import type { AppThunk } from '../../app/store';
import { selectApiUrl } from '../sync/sync.selectors';
import { notify, setImporting } from '../ui/ui.slice';
import {
    selectAllVideos,
    selectNextVideo,
    selectPlayingId,
    selectPlaylistQueue,
    selectPreviousVideo,
    selectShuffleOn,
    selectVideoById,
    selectVideoIdsFor,
} from './videos.selectors';
import { changed, played, removed, replaced, shuffleSet, upserted } from './videos.slice';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Fetches titles for videos that don't have one yet, three at a time. */
export const enrichMetadata =
    (videos: readonly Video[]): AppThunk<Promise<void>> =>
    async (dispatch, getState) => {
        const queue = [...videos];
        const worker = async () => {
            while (queue.length) {
                const video = queue.shift()!;
                const meta = await fetchVideoMetadata(video.youtubeId, selectApiUrl(getState()));
                if (!meta || meta.unavailable) continue;
                const db = getDatabase();
                const current = getVideo(db, video.id);
                if (!current || current.title) continue;
                const updated = updateVideo(db, video.id, { ...meta, ...guessedArtistPatch(current, meta) });
                if (updated) dispatch(changed(updated));
            }
        };
        await Promise.all([worker(), worker(), worker()]);
    };

/** Appends videos to a playlist and fetches titles for the ones that came without one. */
export const addEntries =
    (playlistId: string, entries: readonly (string | VideoEntry)[]): AppThunk<{ added: Video[]; skipped: string[] }> =>
    (dispatch) => {
        const withArtists = entries.map((entry) =>
            typeof entry === 'string' ? entry : { ...entry, ...guessedArtistPatch(entry) },
        );
        const result = addVideos(getDatabase(), playlistId, withArtists);
        if (result.added.length) dispatch(upserted(result.added));
        dispatch(enrichMetadata(result.added.filter((v) => !v.title)));
        return result;
    };

/**
 * Adds every YouTube link found in `text`: video links add that video, and
 * playlist links add all of the playlist's videos. A watch link played from a
 * playlist adds just its video, or the whole playlist with `wholePlaylists`.
 * Resolves to true when at least one video was added.
 */
export const addVideosFromText =
    (playlistId: string, text: string, { wholePlaylists = false } = {}): AppThunk<Promise<boolean>> =>
    async (dispatch) => {
        const { ids, playlistIds, invalid } = extractYouTubeIds(text, { wholePlaylists });
        if (!ids.length && !playlistIds.length) {
            dispatch(notify("That doesn't look like a YouTube link", { tone: 'error' }));
            return false;
        }

        const entries: (string | VideoEntry)[] = [...ids];
        const failures: string[] = [];
        let partial = false;
        if (playlistIds.length) {
            dispatch(setImporting(true));
            try {
                for (const listId of playlistIds) {
                    try {
                        const playlist = await fetchYouTubePlaylist(listId);
                        entries.push(...playlist.videos);
                        partial ||= playlist.partial;
                    } catch (err) {
                        failures.push((err as Error).message);
                    }
                }
            } finally {
                dispatch(setImporting(false));
            }
        }
        if (!entries.length) {
            dispatch(notify(failures[0] ?? 'That playlist has no videos to add', { tone: 'error' }));
            return false;
        }

        const { added, skipped } = dispatch(addEntries(playlistId, entries));
        const parts: string[] = [];
        if (added.length) parts.push(`Added ${plural(added.length, 'video')}`);
        if (skipped.length) parts.push(`${plural(skipped.length, 'video')} already in this playlist`);
        if (invalid.length) parts.push(`${plural(invalid.length, 'link')} skipped`);
        if (failures[0]) parts.push(failures[0]);
        if (partial) parts.push(PARTIAL_IMPORT_NOTE);
        dispatch(
            notify(parts.join('. '), {
                tone: added.length ? 'info' : 'error',
                timeout: partial || failures.length ? 8000 : 4000,
            }),
        );
        return added.length > 0;
    };

export const saveNotes =
    (id: string, notes: string): AppThunk =>
    (dispatch) => {
        const video = updateVideo(getDatabase(), id, { notes: notes.slice(0, 5000) });
        if (video) dispatch(changed(video));
    };

/**
 * A hand edit wins over any guess or lookup, even when it clears the artists.
 * An artist other videos already have keeps their spelling; the edited video
 * itself doesn't count, so fixing its own spelling works.
 */
export const saveArtists =
    (id: string, credits: readonly ArtistCredit[]): AppThunk =>
    (dispatch, getState) => {
        const known = knownCreditNames(selectAllVideos(getState()).filter((v) => v.id !== id));
        const matched = credits.map((c) => ({ ...c, name: matchKnownArtist(c.name, known) }));
        const video = updateVideo(getDatabase(), id, { ...creditsPatch(matched), artistSource: 'user' });
        if (video) dispatch(changed(video));
    };

/** Moves a video to a new index in its playlist's full order. */
export const reorder =
    (id: string, toIndex: number): AppThunk =>
    (dispatch) => {
        const video = reorderVideo(getDatabase(), id, toIndex);
        if (video) dispatch(changed(video));
    };

/**
 * Moves a video to `position`, what a person typed: its place in the whole
 * playlist, from 1, where a number past the end means the end. Anything else is
 * refused with a notice. Returns false when refused.
 */
export const moveToPosition =
    (id: string, position: string): AppThunk<boolean> =>
    (dispatch, getState) => {
        const video = selectVideoById(getState(), id);
        if (!video) return false;
        const ids = selectVideoIdsFor(getState(), video.playlistId);
        const typed = position.trim();
        if (!/^\d+$/.test(typed) || Number(typed) < 1) {
            dispatch(notify(`Enter a position from 1 to ${ids.length}`, { tone: 'error' }));
            return false;
        }
        const toIndex = Math.min(Number(typed), ids.length) - 1;
        if (toIndex !== ids.indexOf(id)) dispatch(reorder(id, toIndex));
        return true;
    };

export const moveToPlaylist =
    (id: string, playlist: Playlist): AppThunk =>
    (dispatch) => {
        const { video, duplicate } = moveVideoToPlaylist(getDatabase(), id, playlist.id);
        if (duplicate) {
            dispatch(notify('That video is already in the other playlist', { tone: 'error' }));
            return;
        }
        if (!video) return;
        dispatch(changed(video));
        dispatch(notify(`Moved to "${playlist.name}"`));
    };

export const removeVideo =
    (id: string): AppThunk =>
    (dispatch) => {
        const db = getDatabase();
        const video = getVideo(db, id);
        if (!video) return;
        deleteVideo(db, id);
        dispatch(removed(id));
        const message = video.title ? `Removed "${video.title}"` : 'Removed the video';
        dispatch(notify(message, { timeout: 6000, undoVideoId: id }));
    };

export const restoreVideo =
    (id: string): AppThunk =>
    (dispatch) => {
        const video = restoreVideoRow(getDatabase(), id);
        if (video) dispatch(changed(video));
    };

export const playNext = (): AppThunk => (dispatch, getState) => {
    const next = selectNextVideo(getState());
    if (next) dispatch(played(next.id));
};

export const playPrevious = (): AppThunk => (dispatch, getState) => {
    const previous = selectPreviousVideo(getState());
    if (previous) dispatch(played(previous.id));
};

const shuffled = <T>(items: readonly T[]): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
};

/** Turning it on shuffles once, from the playing video, so Previous goes back and nothing repeats. */
export const toggleShuffle = (): AppThunk => (dispatch, getState) => {
    const state = getState();
    const playingId = selectPlayingId(state);
    const queue = selectPlaylistQueue(state);
    if (!playingId || !queue[0]) return;
    if (selectShuffleOn(state)) {
        dispatch(shuffleSet(null));
        return;
    }
    const others = queue.map((v) => v.id).filter((id) => id !== playingId);
    dispatch(shuffleSet({ playlistId: queue[0].playlistId, ids: [playingId, ...shuffled(others)] }));
};

/** The YouTube ID in `link`, or null with a notice when it's no link or already in the playlist. */
const linkedYouTubeId =
    (video: Video, link: string): AppThunk<string | null> =>
    (dispatch, getState) => {
        const youtubeId = parseYouTubeId(link.trim());
        if (!youtubeId) {
            dispatch(notify('Paste a YouTube video link, like https://youtu.be/...', { tone: 'error' }));
            return null;
        }
        const duplicate = selectAllVideos(getState()).find(
            (v) => v.playlistId === video.playlistId && v.youtubeId === youtubeId && v.id !== video.id,
        );
        if (duplicate) {
            const name = duplicate.title || youtubeId;
            dispatch(notify(`That video is already in this playlist: "${name}"`, { tone: 'error' }));
            return null;
        }
        return youtubeId;
    };

/**
 * Completes a placeholder, or a video deleted on YouTube, with the YouTube video
 * at `link`: its ID, then the title, channel and thumbnail from YouTube.
 * Resolves to true when saved.
 */
export const completeVideo =
    (id: string, link: string): AppThunk<Promise<boolean>> =>
    async (dispatch, getState) => {
        const db = getDatabase();
        const video = getVideo(db, id);
        if (!video) return false;
        const youtubeId = dispatch(linkedYouTubeId(video, link));
        if (!youtubeId) return false;
        const linked = updateVideo(db, id, {
            ...replacedIdPatch(video, youtubeId),
            youtubeId,
            thumbnailUrl: thumbnailFor(youtubeId),
            unavailable: false,
        });
        if (linked) dispatch(changed(linked));
        const meta = await fetchVideoMetadata(youtubeId, selectApiUrl(getState()));
        const current = getVideo(getDatabase(), id);
        if (meta && !meta.unavailable && current?.youtubeId === youtubeId) {
            const updated = updateVideo(getDatabase(), id, { ...meta, ...guessedArtistPatch(current, meta) });
            if (updated) dispatch(changed(updated));
        }
        return true;
    };

/**
 * Points a video at the YouTube video at `link`, keeping its notes, place and
 * any artist set by hand. Nothing changes unless YouTube has the new video's
 * details, so a video never shows another one's title. Resolves to true when
 * the video has that link.
 */
export const changeVideoLink =
    (id: string, link: string): AppThunk<Promise<boolean>> =>
    async (dispatch, getState) => {
        const video = getVideo(getDatabase(), id);
        if (!video) return false;
        const youtubeId = dispatch(linkedYouTubeId(video, link));
        if (!youtubeId) return false;
        if (youtubeId === video.youtubeId) return true;

        const meta = await fetchVideoMetadata(youtubeId, selectApiUrl(getState()));
        if (!meta || meta.unavailable) {
            const message = meta
                ? "That video isn't available on YouTube"
                : "Couldn't get that video's details from YouTube. Try again.";
            dispatch(notify(message, { tone: 'error' }));
            return false;
        }
        const current = getVideo(getDatabase(), id);
        if (!current) return false;
        const updated = updateVideo(getDatabase(), id, {
            ...meta,
            ...newVideoArtistPatch(current, meta),
            ...replacedIdPatch(current, youtubeId),
            youtubeId,
            unavailable: false,
        });
        if (updated) dispatch(changed(updated));
        return true;
    };

/**
 * Puts back entries missing since an old report near their old place. Entries
 * with a YouTube link become videos; the rest become placeholders that wait for
 * a link. An entry's artist comes from a report with artists; for older reports
 * it's guessed from the title. A JSON report also brings back the channel, notes
 * and deleted mark. Returns the inserted videos.
 */
export const addFromReport =
    (playlistId: string, missing: readonly MissingEntry[]): AppThunk<Video[]> =>
    (dispatch) => {
        const entries = missing.map((entry) => {
            // A link stands in for an unknown title; YouTube's title replaces it below.
            const title = entry.youtubeId && /^https?:\/\//i.test(entry.title) ? '' : entry.title;
            const artist = entry.artist
                ? { ...creditsPatch(splitArtists(entry.artist)), artistSource: 'user' }
                : guessedArtistPatch({ title, author: '', artist: '', artistSource: '' });
            const { author, notes, unavailable, afterId } = entry;
            return { youtubeId: entry.youtubeId ?? '', title, author, notes, unavailable, afterId, ...artist };
        });
        const added = insertVideosAfter(getDatabase(), playlistId, entries);
        if (added.length) dispatch(upserted(added));
        dispatch(enrichMetadata(added.filter((v) => !v.missing && !v.title)));
        return added;
    };

export interface YouTubeSyncCounts {
    added: number;
    addedMissing: number;
    nowUnavailable: number;
    availableAgain: number;
    removed: number;
}

/**
 * Applies a comparison with the playlist's YouTube playlist in one transaction:
 * adds the new videos in YouTube's order, marks or unmarks videos deleted on
 * YouTube, and, with `removeMissing`, removes the videos no longer in the
 * YouTube playlist. Returns how many of each changed.
 */
export const applyYouTubeDiff =
    (playlistId: string, diff: YouTubeDiff<Video>, { removeMissing = false } = {}): AppThunk<YouTubeSyncCounts> =>
    (dispatch) => {
        const db = getDatabase();
        const gone = removeMissing ? diff.removed : [];
        const added = db.transaction(() => {
            const inserted = insertVideosAfter(
                db,
                playlistId,
                diff.added.map((entry) => ({ ...entry, ...guessedArtistPatch(entry) })),
            );
            for (const video of diff.nowUnavailable) updateVideo(db, video.id, { unavailable: true });
            for (const video of diff.availableAgain) updateVideo(db, video.id, { unavailable: false });
            for (const video of gone) deleteVideo(db, video.id);
            return inserted;
        });
        // Reloading also stops the player when the video playing was removed.
        dispatch(replaced(listVideos(db)));
        return {
            added: added.filter((v) => !v.unavailable).length,
            addedMissing: added.filter((v) => v.unavailable).length,
            nowUnavailable: diff.nowUnavailable.length,
            availableAgain: diff.availableAgain.length,
            removed: gone.length,
        };
    };
