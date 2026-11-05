import { getDatabase } from '@ytpm/core/db/index';
import {
    createPlaylist as createPlaylistRow,
    deletePlaylist as deletePlaylistRow,
    listPlaylists,
    updatePlaylist,
    type NewPlaylist,
    type Playlist,
    type PlaylistPatch,
} from '@ytpm/core/playlists/playlists.repository';
import { buildPlaylistReport, reportFileName } from '@ytpm/core/playlists/report';
import type { MissingEntry } from '@ytpm/core/playlists/report-compare';
import type { YouTubeDiff } from '@ytpm/core/playlists/youtube-sync';
import { fetchVideoMetadata } from '@ytpm/core/videos/metadata.client';
import {
    fetchYouTubePlaylist,
    PARTIAL_IMPORT_NOTE,
    UNAVAILABLE_NEEDS_KEY_NOTE,
    type YouTubePlaylist,
} from '@ytpm/core/videos/playlist.client';
import { listVideos, type Video } from '@ytpm/core/videos/videos.repository';
import {
    listProblem,
    parsePlaylistId,
    parseYouTubeId,
    parseYouTubeList,
    videoInPlaylist,
} from '@ytpm/core/videos/youtube';
import type { AppThunk } from '../../app/store';
import { downloadTextFile } from '../../shared/download';
import { notify, setImporting } from '../ui/ui.slice';
import { selectAllVideos } from '../videos/videos.selectors';
import { filterSet, loaded as videosLoaded, playlistDropped } from '../videos/videos.slice';
import { addEntries, addFromReport, applyYouTubeDiff } from '../videos/videos.thunks';
import { selectPlaylistById, selectSelectedPlaylistId } from './playlists.selectors';
import { added, changed, loaded, rememberedPlaylist, rememberPlaylist, removed, selected } from './playlists.slice';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Reads every playlist and video from the local database into the store. */
export const loadLibrary = (): AppThunk => (dispatch) => {
    const db = getDatabase();
    dispatch(loaded({ playlists: listPlaylists(db), preferredId: rememberedPlaylist() }));
    dispatch(videosLoaded(listVideos(db)));
};

/** Creates a playlist and opens it. Returns it, or null when the name is empty. */
export const createPlaylist =
    (fields: NewPlaylist): AppThunk<Playlist | null> =>
    (dispatch) => {
        if (!fields.name.trim()) return null;
        const playlist = createPlaylistRow(getDatabase(), fields);
        if (!playlist) return null;
        dispatch(added(playlist));
        rememberPlaylist(playlist.id);
        return playlist;
    };

export const selectPlaylist =
    (id: string): AppThunk =>
    (dispatch) => {
        dispatch(selected(id));
        rememberPlaylist(id);
    };

export const createFromVideo =
    (youtubeId: string): AppThunk<Promise<Playlist | null>> =>
    async (dispatch) => {
        dispatch(setImporting(true));
        try {
            const meta = await fetchVideoMetadata(youtubeId);
            const title = meta && !meta.unavailable ? meta.title.trim() : '';
            const playlist = dispatch(createPlaylist({ name: title || 'New playlist' }));
            if (playlist) {
                dispatch(addEntries(playlist.id, [meta && !meta.unavailable ? { youtubeId, ...meta } : youtubeId]));
            }
            return playlist;
        } finally {
            dispatch(setImporting(false));
        }
    };

/**
 * Creates a playlist with the title and videos of a public YouTube playlist,
 * and remembers where it came from. With `includeUnavailable`, its deleted and
 * private videos come in as Missing items in their place; otherwise they're left out.
 */
export const importFromYouTube =
    (listId: string, { includeUnavailable = false } = {}): AppThunk<Promise<Playlist | null>> =>
    async (dispatch) => {
        dispatch(setImporting(true));
        try {
            const source = await fetchYouTubePlaylist(listId, '/api', { includeUnavailable });
            const name = source.title?.trim() || 'YouTube playlist';
            const description = source.author ? `Imported from YouTube (${source.author})` : 'Imported from YouTube';
            const playlist = dispatch(createPlaylist({ name, description, source: 'youtube', sourceId: listId }));
            if (!playlist) return null;
            const { added: videos } = dispatch(addEntries(playlist.id, source.videos));
            const gone = videos.filter((v) => v.unavailable).length;
            const parts = [`Imported "${playlist.name}" with ${plural(videos.length - gone, 'video')}`];
            if (gone) parts.push(`${plural(gone, 'deleted or private video')} added as Missing`);
            if (source.skipped) parts.push(`${plural(source.skipped, 'private or deleted video')} left out`);
            if (includeUnavailable && source.source !== 'api' && !source.partial) {
                parts.push(UNAVAILABLE_NEEDS_KEY_NOTE);
            }
            if (source.partial) parts.push(PARTIAL_IMPORT_NOTE);
            dispatch(notify(parts.join('. '), { timeout: source.partial || gone ? 8000 : 4000 }));
            return playlist;
        } catch (err) {
            dispatch(notify((err as Error).message, { tone: 'error', timeout: 6000 }));
            return null;
        } finally {
            dispatch(setImporting(false));
        }
    };

/**
 * Creates a playlist from what the person typed: a name, or a YouTube playlist
 * link (then its title and videos are imported). A Mix can't be imported, so a
 * Mix link starts a playlist with just its video; a private list is refused.
 * With `justVideo`, a watch link played from a playlist starts a playlist with
 * just its video. Resolves to the new playlist, or null when nothing was created.
 */
export const createFromInput =
    (input: string, { justVideo = false, includeUnavailable = false } = {}): AppThunk<Promise<Playlist | null>> =>
    async (dispatch) => {
        const fromList = justVideo ? videoInPlaylist(input) : null;
        if (fromList) return dispatch(createFromVideo(fromList.id));

        const listId = parsePlaylistId(input);
        if (listId) return dispatch(importFromYouTube(listId, { includeUnavailable }));

        const problem = listProblem(input);
        if (!problem) return dispatch(createPlaylist({ name: input }));

        const videoId = parseYouTubeList(input)?.kind === 'mix' ? parseYouTubeId(input) : null;
        if (!videoId) {
            dispatch(notify(problem, { tone: 'error', timeout: 6000 }));
            return null;
        }
        const playlist = await dispatch(createFromVideo(videoId));
        if (playlist) {
            dispatch(notify("YouTube Mixes can't be imported, so only this video was added", { timeout: 6000 }));
        }
        return playlist;
    };

const update =
    (id: string, patch: PlaylistPatch): AppThunk<boolean> =>
    (dispatch) => {
        try {
            const playlist = updatePlaylist(getDatabase(), id, patch);
            if (playlist) dispatch(changed(playlist));
            return Boolean(playlist);
        } catch (err) {
            dispatch(notify((err as Error).message, { tone: 'error' }));
            return false;
        }
    };

export const renamePlaylist = (id: string, name: string): AppThunk<boolean> => update(id, { name });

export const describePlaylist = (id: string, description: string): AppThunk<boolean> => update(id, { description });

/** Deletes a playlist and its videos, and opens the playlist next to it. */
export const deletePlaylist =
    (id: string): AppThunk =>
    (dispatch, getState) => {
        const playlist = selectPlaylistById(getState(), id);
        if (!playlist) return;
        deletePlaylistRow(getDatabase(), id);
        dispatch(removed(id));
        dispatch(playlistDropped(id));
        rememberPlaylist(selectSelectedPlaylistId(getState()));
        dispatch(notify(`Deleted "${playlist.name}"`));
    };

export const downloadReport =
    (id: string): AppThunk =>
    (dispatch, getState) => {
        const playlist = selectPlaylistById(getState(), id);
        if (!playlist) return;
        const fileName = reportFileName(playlist.name);
        const videos = selectAllVideos(getState()).filter((v) => v.playlistId === id);
        downloadTextFile(fileName, buildPlaylistReport(videos));
        dispatch(notify(`Saved ${fileName}`));
    };

/** Adds the entries a comparison found missing back to the playlist. */
export const addMissingFromReport =
    (id: string, missing: readonly MissingEntry[]): AppThunk =>
    (dispatch) => {
        const added = dispatch(addFromReport(id, missing));
        const waiting = added.filter((v) => v.missing).length;
        const parts = [`Added ${plural(added.length, 'missing item')}`];
        if (waiting) parts.push(`${waiting} need${waiting === 1 ? 's' : ''} a YouTube link`);
        dispatch(notify(parts.join('. ')));
        if (waiting) dispatch(filterSet('missing'));
    };

/**
 * Links a playlist to the YouTube playlist at `input` (a link or a bare ID), so
 * it can be synced with it. An empty `input` unlinks it. Returns true when saved.
 */
export const linkToYouTube =
    (id: string, input: string): AppThunk<boolean> =>
    (dispatch) => {
        const text = input.trim();
        if (!text) {
            if (!dispatch(update(id, { source: '' }))) return false;
            dispatch(notify('Unlinked from YouTube'));
            return true;
        }
        const listId = parsePlaylistId(text);
        if (!listId) {
            const problem =
                listProblem(text) ?? 'Paste a YouTube playlist link, like https://www.youtube.com/playlist?list=...';
            dispatch(notify(problem, { tone: 'error' }));
            return false;
        }
        if (!dispatch(update(id, { source: 'youtube', sourceId: listId }))) return false;
        dispatch(notify('Linked to the YouTube playlist'));
        return true;
    };

/**
 * Reads the playlist's linked YouTube playlist, with its deleted and private
 * videos so they aren't mistaken for removed ones, without changing anything.
 * Resolves to null after telling the person what went wrong.
 */
export const readLinkedYouTubePlaylist =
    (id: string): AppThunk<Promise<YouTubePlaylist | null>> =>
    async (dispatch, getState) => {
        const playlist = selectPlaylistById(getState(), id);
        if (playlist?.source !== 'youtube' || !playlist.sourceId) return null;
        try {
            return await fetchYouTubePlaylist(playlist.sourceId, '/api', { includeUnavailable: true });
        } catch (err) {
            dispatch(notify((err as Error).message, { tone: 'error', timeout: 6000 }));
            return null;
        }
    };

/**
 * Applies a comparison with YouTube. With `saveReport`, the playlist's report
 * is downloaded first, as it was before the sync.
 */
export const applyYouTubeSync =
    (id: string, diff: YouTubeDiff<Video>, { removeMissing = false, saveReport = false } = {}): AppThunk =>
    (dispatch) => {
        if (saveReport) dispatch(downloadReport(id));
        const counts = dispatch(applyYouTubeDiff(id, diff, { removeMissing }));
        const parts: string[] = [];
        if (counts.added) parts.push(`${plural(counts.added, 'new video')} added`);
        if (counts.addedMissing) parts.push(`${plural(counts.addedMissing, 'deleted video')} added as Missing`);
        if (counts.nowUnavailable) parts.push(`${counts.nowUnavailable} marked as deleted on YouTube`);
        if (counts.availableAgain) parts.push(`${counts.availableAgain} back on YouTube`);
        if (counts.removed) parts.push(`${counts.removed} removed`);
        const message = parts.length ? `Synced with YouTube: ${parts.join(', ')}` : 'Already in step with YouTube';
        dispatch(notify(message, { timeout: 6000 }));
    };
