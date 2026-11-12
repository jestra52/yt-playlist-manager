import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Like web/: the dev server forwards /api to API_URL (git-ignored web-react/.env, see .env.example),
// or to the local API on :8787.
// `vite preview` serves the same site-wide headers Netlify reads from public/_headers, so
// the Content-Security-Policy is tested locally too.
const siteHeaders = () => {
    const headers: Record<string, string> = {};
    let inSiteBlock = false;
    for (const line of readFileSync(new URL('./public/_headers', import.meta.url), 'utf8').split('\n')) {
        if (!line.trim()) continue;
        if (!/^\s/.test(line)) {
            inSiteBlock = line.trim() === '/*';
            continue;
        }
        if (inSiteBlock) {
            const i = line.indexOf(':');
            headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        }
    }
    return headers;
};

// One version for the whole app, bumped in each release PR (see api/VERSION).
const appVersion = readFileSync(new URL('../api/VERSION', import.meta.url), 'utf8').trim();

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '');
    const proxy = { '/api': { target: env.API_URL || 'http://localhost:8787', changeOrigin: true } };

    return {
        plugins: [tailwindcss(), react()],
        define: { __APP_VERSION__: JSON.stringify(appVersion) },
        server: { port: 5174, strictPort: true, proxy },
        preview: { proxy, headers: siteHeaders() },
        build: { target: 'es2022' },
        test: {
            environment: 'jsdom',
            setupFiles: ['./src/test-setup.ts'],
        },
    };
});
