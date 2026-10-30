import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

// During development the .NET API runs on :8787 (see README); Vite forwards
// /api to it so the app uses the same URL locally and on Netlify.
const apiProxy = {
    '/api': { target: process.env.API_URL ?? 'http://localhost:8787', changeOrigin: true },
};

// `vite preview` serves the same site-wide headers Netlify reads from
// public/_headers, so the Content-Security-Policy is tested locally too.
const siteHeaders = () => {
    const headers = {};
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

export default defineConfig({
    plugins: [tailwindcss(), svelte()],
    // Sass partials in src/styles can be used from anywhere: `@use 'tokens' as *;`
    css: {
        preprocessorOptions: {
            scss: { loadPaths: [fileURLToPath(new URL('./src/styles', import.meta.url))] },
        },
    },
    server: { proxy: apiProxy },
    preview: { proxy: apiProxy, headers: siteHeaders() },
    build: { target: 'es2022' },
    // Tests run the browser build of Svelte so runes-based services are reactive.
    resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
    test: {
        environment: 'node',
        include: ['src/**/*.test.js'],
    },
});
