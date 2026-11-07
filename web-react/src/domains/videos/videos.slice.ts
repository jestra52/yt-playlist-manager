import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Video } from '@ytpm/core/videos/videos.repository';
import { added as playlistAdded, selected as playlistSelected } from '../playlists/playlists.slice';

export type VideoFilter = 'all' | 'missing';

export interface Shuffle {
    playlistId: string;
    ids: string[];
}

export const videosAdapter = createEntityAdapter<Video>({
    sortComparer: (a, b) => a.position - b.position,
});

const initialState = videosAdapter.getInitialState({
    filter: 'all' as VideoFilter,
    query: '',
    playingId: null as string | null,
    shuffle: null as Shuffle | null,
});

const setVideos = (state: typeof initialState, { payload }: PayloadAction<Video[]>) => {
    videosAdapter.setAll(state, payload);
    if (state.playingId && !state.entities[state.playingId]) state.playingId = null;
};

export const videosSlice = createSlice({
    name: 'videos',
    initialState,
    reducers: {
        loaded: setVideos,
        /** Like `loaded`, after an edit made here to many videos at once. */
        replaced: setVideos,
        upserted: videosAdapter.upsertMany,
        changed: videosAdapter.upsertOne,
        removed: (state, { payload }: PayloadAction<string>) => {
            videosAdapter.removeOne(state, payload);
            if (state.playingId === payload) state.playingId = null;
        },
        playlistDropped: (state, { payload }: PayloadAction<string>) => {
            const ids = Object.values(state.entities)
                .filter((v) => v.playlistId === payload)
                .map((v) => v.id);
            videosAdapter.removeMany(state, ids);
            if (state.playingId && !state.entities[state.playingId]) state.playingId = null;
        },
        filterSet: (state, { payload }: PayloadAction<VideoFilter>) => {
            state.filter = payload;
        },
        querySet: (state, { payload }: PayloadAction<string>) => {
            state.query = payload;
        },
        played: (state, { payload }: PayloadAction<string>) => {
            if (state.entities[payload] && !state.entities[payload].missing) state.playingId = payload;
        },
        playerClosed: (state) => {
            state.playingId = null;
        },
        shuffleSet: (state, { payload }: PayloadAction<Shuffle | null>) => {
            state.shuffle = payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(playlistSelected, (state, { payload }) => {
                if (state.shuffle?.playlistId !== payload) state.shuffle = null;
            })
            .addCase(playlistAdded, (state) => {
                state.shuffle = null;
            });
    },
});

export const {
    loaded,
    replaced,
    upserted,
    changed,
    removed,
    playlistDropped,
    filterSet,
    querySet,
    played,
    playerClosed,
    shuffleSet,
} = videosSlice.actions;
