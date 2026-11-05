import { getDatabase } from '@ytpm/core/db/index';
import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { guessedArtistPatch, knownArtists, matchKnownArtist } from '@ytpm/core/videos/artist';
import { fetchVideoMetadata } from '@ytpm/core/videos/metadata.client';
import { fetchYouTubePlaylist, PARTIAL_IMPORT_NOTE } from '@ytpm/core/videos/playlist.client';
import {
    addVideos,
    deleteVideo,
    getVideo,
    moveVideoToPlaylist,
    reorderVideo,
    restoreVideo as restoreVideoRow,
    updateVideo,
    type Video,
    type VideoEntry,
} from '@ytpm/core/videos/videos.repository';
import { extractYouTubeIds, parseYouTubeId, thumbnailFor } from '@ytpm/core/videos/youtube';
import type { AppThunk } from '../../app/store';
import { notify, setImporting } from '../ui/ui.slice';
import { selectAllVideos, selectPlaying } from './videos.selectors';
import { changed, played, playerClosed, removed, upserted } from './videos.slice';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Fetches titles for videos that don't have one yet, three at a time. */
export const enrichMetadata =
    (videos: readonly Video[]): AppThunk<Promise<void>> =>
    async (dispatch) => {
        const queue = [...videos];
        const worker = async () => {
            while (queue.length) {
                const video = queue.shift()!;
                const meta = await fetchVideoMetadata(video.youtubeId);
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

export const setWatched =
    (id: string, watched: boolean): AppThunk =>
    (dispatch) => {
        const video = updateVideo(getDatabase(), id, { watched });
        if (video) dispatch(changed(video));
    };

export const saveNotes =
    (id: string, notes: string): AppThunk =>
    (dispatch) => {
        const video = updateVideo(getDatabase(), id, { notes: notes.slice(0, 5000) });
        if (video) dispatch(changed(video));
    };

/**
 * A hand edit wins over any guess or lookup, even when it clears the artist.
 * An artist other videos already have keeps their spelling; the edited video
 * itself doesn't count, so fixing its own spelling works.
 */
export const saveArtist =
    (id: string, artist: string): AppThunk =>
    (dispatch, getState) => {
        const known = knownArtists(selectAllVideos(getState()).filter((v) => v.id !== id));
        const video = updateVideo(getDatabase(), id, { artist: matchKnownArtist(artist, known), artistSource: 'user' });
        if (video) dispatch(changed(video));
    };

/** Moves a video to a new index in its playlist's full order. */
export const reorder =
    (id: string, toIndex: number): AppThunk =>
    (dispatch) => {
        const video = reorderVideo(getDatabase(), id, toIndex);
        if (video) dispatch(changed(video));
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

/** Marks the playing video watched and starts the next unwatched one. */
export const finishAndPlayNext = (): AppThunk => (dispatch, getState) => {
    const current = selectPlaying(getState());
    if (!current) return;
    dispatch(setWatched(current.id, true));
    const queue = selectAllVideos(getState()).filter((v) => v.playlistId === current.playlistId);
    const playable = (v: Video) => !v.watched && !v.missing;
    const next = queue.find((v) => v.position > current.position && playable(v)) ?? queue.find(playable);
    if (next) {
        dispatch(played(next.id));
    } else {
        dispatch(playerClosed());
        dispatch(notify("You've watched everything in this playlist"));
    }
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
        const youtubeId = parseYouTubeId(link.trim());
        if (!youtubeId) {
            dispatch(notify('Paste a YouTube video link, like https://youtu.be/...', { tone: 'error' }));
            return false;
        }
        const duplicate = selectAllVideos(getState()).find(
            (v) => v.playlistId === video.playlistId && v.youtubeId === youtubeId && v.id !== id,
        );
        if (duplicate) {
            const name = duplicate.title || youtubeId;
            dispatch(notify(`That video is already in this playlist: "${name}"`, { tone: 'error' }));
            return false;
        }
        const linked = updateVideo(db, id, { youtubeId, thumbnailUrl: thumbnailFor(youtubeId), unavailable: false });
        if (linked) dispatch(changed(linked));
        const meta = await fetchVideoMetadata(youtubeId);
        const current = getVideo(getDatabase(), id);
        if (meta && !meta.unavailable && current?.youtubeId === youtubeId) {
            const updated = updateVideo(getDatabase(), id, { ...meta, ...guessedArtistPatch(current, meta) });
            if (updated) dispatch(changed(updated));
        }
        return true;
    };
