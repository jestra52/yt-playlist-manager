import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import type { Video } from '@ytpm/core/videos/videos.repository';

export const videosAdapter = createEntityAdapter<Video>({
    sortComparer: (a, b) => a.position - b.position,
});

export const videosSlice = createSlice({
    name: 'videos',
    initialState: videosAdapter.getInitialState(),
    reducers: {
        loaded: videosAdapter.setAll,
        upserted: videosAdapter.upsertMany,
        changed: videosAdapter.upsertOne,
        removed: videosAdapter.removeOne,
    },
});

export const { loaded, upserted, changed, removed } = videosSlice.actions;
