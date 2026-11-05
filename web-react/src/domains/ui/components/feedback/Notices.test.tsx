import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../../../../app/store';
import { notify } from '../../ui.slice';
import { Notices } from './Notices';

const setup = () => {
    const store = createStore();
    render(
        <Provider store={store}>
            <Notices />
        </Provider>,
    );
    return store;
};

describe('Notices', () => {
    it('shows every notice, and dismisses one with its button', () => {
        const store = setup();
        act(() => {
            store.dispatch(notify('One'));
            store.dispatch(notify('Two'));
        });
        expect(screen.getAllByRole('status')).toHaveLength(2);
        fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]!);
        expect(screen.queryByText('One')).not.toBeInTheDocument();
        expect(screen.getByText('Two')).toBeInTheDocument();
    });

    it('leaves on its own after the timeout, unless it has none', () => {
        vi.useFakeTimers();
        const store = setup();
        act(() => {
            store.dispatch(notify('Brief', { timeout: 1000 }));
            store.dispatch(notify('Stays', { timeout: 0 }));
        });
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        vi.useRealTimers();
        expect(screen.queryByText('Brief')).not.toBeInTheDocument();
        expect(screen.getByText('Stays')).toBeInTheDocument();
    });
});
