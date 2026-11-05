import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
    cleanup();
    localStorage.clear();
});

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    }),
});

HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
};
HTMLDialogElement.prototype.close = function close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
};
