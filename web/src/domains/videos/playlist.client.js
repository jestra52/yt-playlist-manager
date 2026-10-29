/** Reads a public YouTube playlist through the app's Go API (/api/playlist). */

export class PlaylistImportError extends Error {}

/**
 * Returns { id, title, author, videos: [{ youtubeId, title, author, thumbnailUrl }], skipped, partial, source }.
 * Throws PlaylistImportError with a message ready to show to the person.
 */
export async function fetchYouTubePlaylist(listId, apiBase = '/api') {
    const url = `${apiBase.replace(/\/+$/, '')}/playlist?id=${encodeURIComponent(listId)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let res;
    try {
        res = await fetch(url, { signal: ctrl.signal });
    } catch {
        throw new PlaylistImportError(
            typeof navigator !== 'undefined' && navigator.onLine === false
                ? 'You’re offline. Importing a playlist needs a connection.'
                : 'Can’t reach the API to read the playlist. Is it running?',
        );
    } finally {
        clearTimeout(timer);
    }

    let body = null;
    try {
        body = await res.json();
    } catch {
        /* not JSON: handled below */
    }
    if (res.status === 404) {
        throw new PlaylistImportError(
            body?.error ? capitalize(body.error) : 'That playlist wasn’t found. It may be private.',
        );
    }
    if (!res.ok || !body || !Array.isArray(body.videos)) {
        throw new PlaylistImportError(body?.error ? capitalize(body.error) : 'YouTube didn’t return the playlist.');
    }
    return body;
}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
