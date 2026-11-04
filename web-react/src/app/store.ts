import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { saveTheme, savedTheme, uiSlice } from '../domains/ui/ui.slice';

export const createStore = (preloadedState?: Partial<{ ui: ReturnType<typeof uiSlice.reducer> }>) => {
    const store = configureStore({
        reducer: { ui: uiSlice.reducer },
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

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
