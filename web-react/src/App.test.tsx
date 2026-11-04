import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { createStore } from './app/store';
import { setTheme, toggleSidebar, uiSlice } from './domains/ui/ui.slice';

describe('ui slice', () => {
    it('sets the theme and toggles the sidebar', () => {
        let state = uiSlice.reducer(undefined, setTheme('dark'));
        expect(state.theme).toBe('dark');
        state = uiSlice.reducer(state, toggleSidebar());
        expect(state.sidebarOpen).toBe(true);
        state = uiSlice.reducer(state, toggleSidebar(false));
        expect(state.sidebarOpen).toBe(false);
    });

    it('starts from the saved theme and saves a new choice', () => {
        localStorage.setItem('ytpm:theme', 'light');
        const store = createStore();
        expect(store.getState().ui.theme).toBe('light');
        store.dispatch(setTheme('system'));
        expect(localStorage.getItem('ytpm:theme')).toBeNull();
        store.dispatch(setTheme('dark'));
        expect(localStorage.getItem('ytpm:theme')).toBe('dark');
    });
});

describe('App', () => {
    it('shows the brand and switches the theme', () => {
        const store = createStore({ ui: { theme: 'system', sidebarOpen: true } });
        render(<App store={store} />);
        expect(screen.getAllByText('Yuzu Tapes').length).toBeGreaterThan(0);
        fireEvent.click(screen.getAllByRole('button', { name: 'Dark' })[0]!);
        expect(store.getState().ui.theme).toBe('dark');
    });
});
