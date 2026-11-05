import { getDatabase } from '@ytpm/core/db/index';
import { guessedArtistPatch } from '@ytpm/core/videos/artist';
import { fetchVideoMetadata } from '@ytpm/core/videos/metadata.client';
import { fetchYouTubePlaylist, PARTIAL_IMPORT_NOTE } from '@ytpm/core/videos/playlist.client';
import { addVideos, getVideo, updateVideo, type Video, type VideoEntry } from '@ytpm/core/videos/videos.repository';
import { extractYouTubeIds } from '@ytpm/core/videos/youtube';
import type { AppThunk } from '../../app/store';
import { notify, setImporting } from '../ui/ui.slice';
import { changed, upserted } from './videos.slice';

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
