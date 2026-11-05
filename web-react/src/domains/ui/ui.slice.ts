import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Notice {
    id: string;
    message: string;
    tone: 'info' | 'error';
    timeout: number;
    undoVideoId?: string;
}

export interface UiState {
    theme: ThemeChoice;
    sidebarOpen: boolean;
    importing: boolean;
    notices: Notice[];
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

const initialState: UiState = { theme: 'system', sidebarOpen: false, importing: false, notices: [] };

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
        setImporting: (state, { payload }: PayloadAction<boolean>) => {
            state.importing = payload;
        },
        notify: {
            reducer: (state, { payload }: PayloadAction<Notice>) => {
                state.notices.push(payload);
            },
            prepare: (
                message: string,
                { tone = 'info', timeout = 4000, undoVideoId }: Partial<Omit<Notice, 'id' | 'message'>> = {},
            ) => ({
                payload: { id: nanoid(), message, tone, timeout, undoVideoId },
            }),
        },
        dismissNotice: (state, { payload }: PayloadAction<string>) => {
            state.notices = state.notices.filter((notice) => notice.id !== payload);
        },
    },
});

export const { setTheme, toggleSidebar, setImporting, notify, dismissNotice } = uiSlice.actions;
