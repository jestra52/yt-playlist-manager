import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../../../../app/store';
import { notify } from '../../ui.slice';
import { Notices } from '../feedback/Notices';
import { AppDialog } from './AppDialog';

describe('AppDialog', () => {
    it('renders nothing until it opens', () => {
        render(
            <AppDialog open={false} onClose={() => {}} title="Title">
                Body
            </AppDialog>,
        );
        expect(document.querySelector('dialog')).not.toBeInTheDocument();
    });

    it('names the dialog after its title', () => {
        render(
            <AppDialog open onClose={() => {}} title="Title">
                Body
            </AppDialog>,
        );
        expect(screen.getByRole('dialog', { name: 'Title' })).toHaveTextContent('Body');
    });

    it('asks to close when the browser closes it, as Esc does', () => {
        const onClose = vi.fn();
        render(
            <AppDialog open onClose={onClose} title="Title">
                Body
            </AppDialog>,
        );
        act(() => screen.getByRole<HTMLDialogElement>('dialog').close());
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('ignores a late close event from before it reopened', () => {
        const onClose = vi.fn();
        render(
            <AppDialog open onClose={onClose} title="Title">
                Body
            </AppDialog>,
        );
        fireEvent(screen.getByRole('dialog'), new Event('close'));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('closes from its own state on Esc and on the backdrop, without waiting for the browser', () => {
        const onClose = vi.fn();
        render(
            <AppDialog open onClose={onClose} title="Title">
                Body
            </AppDialog>,
        );
        const dialog = screen.getByRole<HTMLDialogElement>('dialog');
        expect(fireEvent(dialog, new Event('cancel', { cancelable: true }))).toBe(false);
        fireEvent.click(dialog.querySelector('.modal-backdrop button')!);
        expect(onClose).toHaveBeenCalledTimes(2);
        expect(dialog.open).toBe(true);
    });

    it('stays in the page while it leaves, then tells its owner', async () => {
        const onExited = vi.fn();
        const dialog = (open: boolean) => (
            <AppDialog open={open} onClose={() => {}} onExited={onExited} title="Title">
                Body
            </AppDialog>
        );
        const { rerender } = render(dialog(true));
        rerender(dialog(false));
        expect(document.querySelector('dialog')).toBeInTheDocument();
        expect(onExited).not.toHaveBeenCalled();
        await waitFor(() => expect(onExited).toHaveBeenCalledOnce());
        expect(document.querySelector('dialog')).not.toBeInTheDocument();
    });

    it('shows notices inside the open dialog, where they can be used', () => {
        const store = createStore();
        render(
            <Provider store={store}>
                <AppDialog open onClose={() => {}} title="Title">
                    Body
                </AppDialog>
                <Notices />
            </Provider>,
        );
        act(() => {
            store.dispatch(notify('Saved'));
        });
        expect(screen.getByRole('dialog')).toContainElement(screen.getByText('Saved'));
    });
});
