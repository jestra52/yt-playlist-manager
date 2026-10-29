/**
 * A tiny signal that synced data changed locally. Services call
 * `dataChanged()` after writing; the sync service listens and schedules a
 * background sync. Keeps the data domains from depending on sync.
 */
const listeners = new Set();

export const onDataChanged = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const dataChanged = () => {
    for (const listener of listeners) listener();
};
