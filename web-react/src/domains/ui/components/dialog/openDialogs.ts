import { useSyncExternalStore } from 'react';

const stack: HTMLDialogElement[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export const trackDialog = (dialog: HTMLDialogElement) => {
    stack.push(dialog);
    notify();
    return () => {
        stack.splice(stack.indexOf(dialog), 1);
        notify();
    };
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** The modal dialog on top. Everything outside it is inert, so what must stay usable goes inside. */
export const useTopDialog = () => useSyncExternalStore(subscribe, () => stack.at(-1) ?? null);
