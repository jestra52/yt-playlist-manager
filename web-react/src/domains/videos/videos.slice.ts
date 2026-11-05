import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Video } from '@ytpm/core/videos/videos.repository';

export type VideoFilter = 'all' | 'unwatched' | 'watched' | 'missing';

export const videosAdapter = createEntityAdapter<Video>({
    sortComparer: (a, b) => a.position - b.position,
});

export const videosSlice = createSlice({
    name: 'videos',
    initialState: videosAdapter.getInitialState({
        filter: 'all' as VideoFilter,
        query: '',
        playingId: null as string | null,
    }),
    reducers: {
        loaded: (state, { payload }: PayloadAction<Video[]>) => {
            videosAdapter.setAll(state, payload);
            if (state.playingId && !state.entities[state.playingId]) state.playingId = null;
        },
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
    },
});

export const { loaded, upserted, changed, removed, playlistDropped, filterSet, querySet, played, playerClosed } =
    videosSlice.actions;
