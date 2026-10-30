// Runs after `vite build` on Netlify: proxies /api/* to the .NET API on Render, so the
// web app keeps calling its own origin (no CORS, and the CSP stays 'self').
// Set API_ORIGIN in Netlify, e.g. https://yt-playlist-manager-api.onrender.com
import { writeFileSync } from 'node:fs';

const origin = (process.env.API_ORIGIN ?? '').trim().replace(/\/+$/, '');
const target = new URL('../dist/_redirects', import.meta.url);

if (!origin) {
    console.warn('API_ORIGIN is not set: /api will not reach the API. The app still works on each device.');
} else if (!/^https:\/\/[^/]+$/.test(origin)) {
    console.error(`API_ORIGIN must look like https://your-api.onrender.com (got "${origin}")`);
    process.exit(1);
} else {
    writeFileSync(target, `/api/*  ${origin}/api/:splat  200!\n`);
    console.warn(`Proxying /api/* to ${origin}/api/`);
}
