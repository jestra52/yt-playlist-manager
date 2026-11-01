import { drizzle } from 'drizzle-orm/sql-js';
import { migrations } from './schema.js';
import * as tables from './tables.js';

/**
 * A thin wrapper around a sql.js (SQLite compiled to WebAssembly) database.
 * The whole database lives in memory and is saved to a persistence adapter
 * (IndexedDB in the browser) shortly after every write.
 *
 * Repositories build their queries with Drizzle ORM (`db.orm`), so values are
 * always sent as parameters. Reads run the query directly (`.all()`, `.get()`);
 * writes go through `db.write(query)` so the change is saved.
 */
export class Database {
    #db;
    #orm;
    #persistence;
    #saveTimer = null;
    #depth = 0;
    #listeners = new Set();

    constructor(sqlDb, persistence = null) {
        this.#persistence = persistence;
        this.#open(sqlDb);
    }

    #open(sqlDb) {
        this.#db = sqlDb;
        this.#orm = drizzle(sqlDb, { schema: tables });
        this.#db.exec('PRAGMA foreign_keys = ON;');
        this.#migrate();
    }

    #migrate() {
        const current = this.#userVersion();
        for (let v = current; v < migrations.length; v++) {
            this.transaction(() => {
                this.#db.exec(migrations[v]);
                // PRAGMA takes no parameters; the version is always a loop integer.
                this.#db.exec(`PRAGMA user_version = ${Number(v + 1)}`);
            });
        }
    }

    #userVersion() {
        const [result] = this.#db.exec('PRAGMA user_version');
        return Number(result?.values[0]?.[0] ?? 0);
    }

    /** The Drizzle ORM instance for building queries (see `tables.js`). */
    get orm() {
        return this.#orm;
    }

    /** Runs a Drizzle insert, update or delete and returns the number of changed rows. */
    write(query) {
        query.run();
        const changes = this.#db.getRowsModified();
        if (this.#depth === 0) this.#changed();
        return changes;
    }

    /** Runs fn inside a transaction (nested calls join the outer one). */
    transaction(fn) {
        if (this.#depth > 0) {
            this.#depth++;
            try {
                return fn();
            } finally {
                this.#depth--;
            }
        }
        this.#db.exec('BEGIN');
        this.#depth = 1;
        try {
            const result = fn();
            this.#db.exec('COMMIT');
            return result;
        } catch (err) {
            this.#db.exec('ROLLBACK');
            throw err;
        } finally {
            this.#depth = 0;
            this.#changed();
        }
    }

    /** Swaps in another copy of the database (e.g. one saved by another tab). */
    replace(sqlDb) {
        clearTimeout(this.#saveTimer);
        this.#saveTimer = null;
        const old = this.#db;
        this.#open(sqlDb);
        old.close();
    }

    /** Serializes the database to a SQLite file (Uint8Array). */
    export() {
        return this.#db.export();
    }

    /** Called after writes are saved; used to tell other tabs. */
    onSaved(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    #changed() {
        if (!this.#persistence) return;
        clearTimeout(this.#saveTimer);
        this.#saveTimer = setTimeout(() => this.flush(), 150);
    }

    /** Saves immediately (also used before the page is hidden). */
    async flush() {
        clearTimeout(this.#saveTimer);
        this.#saveTimer = null;
        if (!this.#persistence) return;
        await this.#persistence.save(this.#db.export());
        for (const listener of this.#listeners) listener();
    }

    close() {
        clearTimeout(this.#saveTimer);
        this.#db.close();
    }
}

/** Monotonic "now" so an edit always gets a strictly newer updated_at. */
let lastStamp = 0;
export const now = () => {
    const t = Date.now();
    lastStamp = t > lastStamp ? t : lastStamp + 1;
    return lastStamp;
};

/** Collision-resistant row id (letters, digits, '-' only). */
export const newId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};
