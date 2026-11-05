import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Playlist } from '@ytpm/core/playlists/playlists.repository';

const SELECTED_KEY = 'ytpm:selectedPlaylist';

export const rememberedPlaylist = (): string | null => {
    try {
        return localStorage.getItem(SELECTED_KEY);
    } catch {
        return null;
    }
};

export const rememberPlaylist = (id: string | null): void => {
    try {
        if (id) localStorage.setItem(SELECTED_KEY, id);
    } catch {
        /* storage unavailable: the selection just isn't remembered */
    }
};

export const playlistsAdapter = createEntityAdapter<Playlist>({
    sortComparer: (a, b) => a.position - b.position || a.createdAt - b.createdAt,
});

export const playlistsSlice = createSlice({
    name: 'playlists',
    initialState: playlistsAdapter.getInitialState({ selectedId: null as string | null }),
    reducers: {
        loaded: (state, { payload }: PayloadAction<{ playlists: Playlist[]; preferredId: string | null }>) => {
            playlistsAdapter.setAll(state, payload.playlists);
            const preferred = payload.preferredId ?? state.selectedId;
            state.selectedId =
                preferred && state.entities[preferred]
                    ? preferred
                    : (playlistsAdapter.getSelectors().selectIds(state)[0] ?? null);
        },
        added: (state, { payload }: PayloadAction<Playlist>) => {
            playlistsAdapter.addOne(state, payload);
            state.selectedId = payload.id;
        },
        selected: (state, { payload }: PayloadAction<string>) => {
            if (state.entities[payload]) state.selectedId = payload;
        },
        changed: playlistsAdapter.upsertOne,
        removed: (state, { payload }: PayloadAction<string>) => {
            const index = state.ids.indexOf(payload);
            playlistsAdapter.removeOne(state, payload);
            if (state.selectedId === payload) {
                state.selectedId = state.ids[Math.min(index, state.ids.length - 1)] ?? null;
            }
        },
    },
});

export const { loaded, added, selected, changed, removed } = playlistsSlice.actions;
