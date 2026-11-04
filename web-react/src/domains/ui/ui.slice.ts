import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface UiState {
    theme: ThemeChoice;
    sidebarOpen: boolean;
}

const THEME_KEY = 'ytpm:theme';

export const savedTheme = (): ThemeChoice => {
    try {
        const value = localStorage.getItem(THEME_KEY);
        return value === 'light' || value === 'dark' ? value : 'system';
    } catch {
        return 'system';
    }
};

export const saveTheme = (theme: ThemeChoice): void => {
    try {
        if (theme === 'system') localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, theme);
    } catch {
        /* storage blocked: the choice lasts for this visit */
    }
};

const initialState: UiState = { theme: 'system', sidebarOpen: false };

export const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setTheme: (state, { payload }: PayloadAction<ThemeChoice>) => {
            state.theme = payload;
        },
        toggleSidebar: (state, { payload }: PayloadAction<boolean | undefined>) => {
            state.sidebarOpen = payload ?? !state.sidebarOpen;
        },
    },
});

export const { setTheme, toggleSidebar } = uiSlice.actions;
