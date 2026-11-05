import { getDatabase } from '@ytpm/core/db/index';
import {
    createPlaylist as createPlaylistRow,
    listPlaylists,
    type NewPlaylist,
    type Playlist,
} from '@ytpm/core/playlists/playlists.repository';
import { fetchVideoMetadata } from '@ytpm/core/videos/metadata.client';
import {
    fetchYouTubePlaylist,
    PARTIAL_IMPORT_NOTE,
    UNAVAILABLE_NEEDS_KEY_NOTE,
} from '@ytpm/core/videos/playlist.client';
import { listVideos } from '@ytpm/core/videos/videos.repository';
import {
    listProblem,
    parsePlaylistId,
    parseYouTubeId,
    parseYouTubeList,
    videoInPlaylist,
} from '@ytpm/core/videos/youtube';
import type { AppThunk } from '../../app/store';
import { notify, setImporting } from '../ui/ui.slice';
import { loaded as videosLoaded } from '../videos/videos.slice';
import { addEntries } from '../videos/videos.thunks';
import { added, loaded, rememberedPlaylist, rememberPlaylist, selected } from './playlists.slice';

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
