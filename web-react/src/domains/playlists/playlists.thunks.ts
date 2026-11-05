import { getDatabase } from '@ytpm/core/db/index';
import { createPlaylist as createPlaylistRow, listPlaylists } from '@ytpm/core/playlists/playlists.repository';
import { listVideos } from '@ytpm/core/videos/videos.repository';
import type { AppThunk } from '../../app/store';
import { loaded as videosLoaded } from '../videos/videos.slice';
import { added, loaded, rememberedPlaylist, rememberPlaylist, selected } from './playlists.slice';

/** Reads every playlist and video from the local database into the store. */
export const loadLibrary = (): AppThunk => (dispatch) => {
    const db = getDatabase();
    dispatch(loaded({ playlists: listPlaylists(db), preferredId: rememberedPlaylist() }));
    dispatch(videosLoaded(listVideos(db)));
};

/** Creates a playlist and opens it. Resolves to its ID, or null when the name is empty. */
export const createPlaylist =
    (name: string): AppThunk<string | null> =>
    (dispatch) => {
        if (!name.trim()) return null;
        const playlist = createPlaylistRow(getDatabase(), { name });
        if (!playlist) return null;
        dispatch(added(playlist));
        rememberPlaylist(playlist.id);
        return playlist.id;
    };

export const selectPlaylist =
    (id: string): AppThunk =>
    (dispatch) => {
        dispatch(selected(id));
        rememberPlaylist(id);
    };
