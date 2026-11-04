import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Like web/: the dev server forwards /api to API_URL (git-ignored web-react/.env, see .env.example),
// or to the local API on :8787.
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '');
    return {
        plugins: [react()],
        server: {
            port: 5174,
            strictPort: true,
            proxy: { '/api': { target: env.API_URL || 'http://localhost:8787', changeOrigin: true } },
        },
        test: {
            environment: 'jsdom',
            setupFiles: ['./src/test-setup.ts'],
        },
    };
});
