import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` compares src/core/db/tables.js with the last snapshot in
// src/core/db/migrations/meta and writes the SQL for any change as a new migration.
export default defineConfig({
    dialect: 'sqlite',
    schema: './src/core/db/tables.js',
    out: './src/core/db/migrations',
});
