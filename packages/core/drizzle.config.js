import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` compares src/db/tables.ts with the last snapshot in
// src/db/migrations/meta and writes the SQL for any change as a new migration.
export default defineConfig({
    dialect: 'sqlite',
    schema: './src/db/tables.ts',
    out: './src/db/migrations',
});
