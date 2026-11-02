/** Reads a public YouTube playlist through the app's API (/api/playlist). */

export class PlaylistImportError extends Error {}

/**
 * Returns { id, title, author, videos: [{ youtubeId, title, author, thumbnailUrl, unavailable }],
 * skipped, partial, source }. With `includeUnavailable`, deleted and private videos come back
 * in their place with `unavailable: true` (only when the API reads YouTube with an API key,
 * i.e. `source` is 'api'); otherwise they're left out and counted in `skipped`.
 * Throws PlaylistImportError with a message ready to show to the person.
 */
export const fetchYouTubePlaylist = async (listId, apiBase = '/api', { includeUnavailable = false } = {}) => {
    const query = `id=${encodeURIComponent(listId)}${includeUnavailable ? '&includeUnavailable=true' : ''}`;
    const url = `${apiBase.replace(/\/+$/, '')}/playlist?${query}`;
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
};

const capitalize = (text) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
};
