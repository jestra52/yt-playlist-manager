import type { Database } from './database';

/**
 * Holds the single open database so repositories don't need it passed around
 * by views. The app bootstrap sets it; tests can inject an in-memory one.
 */
let current: Database | null = null;

export const setDatabase = (db: Database | null): void => {
    current = db;
};

export const getDatabase = (): Database => {
    if (!current) throw new Error('Database is not open yet');
    return current;
};

export { Database, now, newId, type Persistence } from './database';
