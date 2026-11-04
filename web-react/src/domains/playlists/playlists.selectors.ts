import type { RootState } from '../../app/store';
import { playlistsAdapter } from './playlists.slice';

const selectors = playlistsAdapter.getSelectors((state: RootState) => state.playlists);

export const selectPlaylists = selectors.selectAll;
export const selectPlaylistById = selectors.selectById;
export const selectSelectedPlaylistId = (state: RootState) => state.playlists.selectedId;
export const selectSelectedPlaylist = (state: RootState) =>
    state.playlists.selectedId ? (state.playlists.entities[state.playlists.selectedId] ?? null) : null;
