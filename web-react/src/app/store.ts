import { configureStore, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { playlistsSlice } from '../domains/playlists/playlists.slice';
import { saveTheme, savedTheme, uiSlice, type UiState } from '../domains/ui/ui.slice';
import { videosSlice } from '../domains/videos/videos.slice';

export const createStore = (preloadedState?: { ui?: Partial<UiState> }) => {
    const store = configureStore({
        reducer: {
            ui: uiSlice.reducer,
            playlists: playlistsSlice.reducer,
            videos: videosSlice.reducer,
        },
        preloadedState: { ui: { ...uiSlice.getInitialState(), theme: savedTheme(), ...preloadedState?.ui } },
    });
    let theme = store.getState().ui.theme;
    store.subscribe(() => {
        const next = store.getState().ui.theme;
        if (next !== theme) saveTheme((theme = next));
    });
    return store;
};

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<R = void> = ThunkAction<R, RootState, unknown, UnknownAction>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
