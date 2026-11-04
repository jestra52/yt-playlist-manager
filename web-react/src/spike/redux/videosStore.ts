import { configureStore, createEntityAdapter, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { PLAYLISTS, type SpikeVideo } from '../fixture';

const videosAdapter = createEntityAdapter<SpikeVideo>();

const videosSlice = createSlice({
    name: 'videos',
    initialState: videosAdapter.getInitialState(),
    reducers: {
        loaded: videosAdapter.setAll,
        watchedSet: (state, { payload }: PayloadAction<{ id: string; watched: boolean }>) => {
            const video = state.entities[payload.id];
            if (video) video.watched = payload.watched;
        },
    },
});

export const { loaded, watchedSet } = videosSlice.actions;

export const createVideosStore = (videos: SpikeVideo[]) => {
    const store = configureStore({ reducer: { videos: videosSlice.reducer } });
    store.dispatch(loaded(videos));
    return store;
};

type SpikeState = ReturnType<ReturnType<typeof createVideosStore>['getState']>;
type SpikeDispatch = ReturnType<typeof createVideosStore>['dispatch'];

const selectors = videosAdapter.getSelectors((state: SpikeState) => state.videos);

export const selectVideoById = selectors.selectById;

export const selectVideoIdsFor = createSelector(
    [selectors.selectAll, (_: SpikeState, playlistId: string) => playlistId],
    (videos, playlistId) => videos.filter((v) => v.playlistId === playlistId).map((v) => v.id),
    {
        memoizeOptions: {
            resultEqualityCheck: (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]),
        },
    },
);

export const selectCounts = createSelector([selectors.selectAll], (videos) =>
    PLAYLISTS.map((p) => {
        const mine = videos.filter((v) => v.playlistId === p.id);
        return { id: p.id, name: p.name, left: mine.filter((v) => !v.watched).length, total: mine.length };
    }),
);

export const useSpikeDispatch = useDispatch.withTypes<SpikeDispatch>();
export const useSpikeSelector = useSelector.withTypes<SpikeState>();
