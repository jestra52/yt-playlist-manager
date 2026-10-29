/**
 * Holds the single open database so repositories don't need it passed around
 * by views. The app bootstrap sets it; tests can inject an in-memory one.
 */
let current = null;

export function setDatabase(db) {
  current = db;
}

export function getDatabase() {
  if (!current) throw new Error('Database is not open yet');
  return current;
}

export { Database, now, newId } from './database.js';
