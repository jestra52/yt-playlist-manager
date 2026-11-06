/** Reads a public YouTube playlist through the app's API (/api/playlist). */

export class PlaylistImportError extends Error {}

export interface YouTubePlaylistVideo {
    youtubeId: string;
    title: string;
    author: string;
    thumbnailUrl: string;
    unavailable?: boolean;
}

export interface YouTubePlaylist {
    id: string;
    title: string;
    author: string;
    videos: YouTubePlaylistVideo[];
    skipped: number;
    partial: boolean;
    source: string;
}

const capitalize = (text: string): string => {
    return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Returns { id, title, author, videos: [{ youtubeId, title, author, thumbnailUrl, unavailable }],
 * skipped, partial, source }. With `includeUnavailable`, deleted and private videos come back
 * in their place with `unavailable: true` (only when the API reads YouTube with an API key,
 * i.e. `source` is 'api'); otherwise they're left out and counted in `skipped`.
 * Throws PlaylistImportError with a message ready to show to the person.
 */
export const fetchYouTubePlaylist = async (
    listId: string,
    apiBase = '/api',
    { includeUnavailable = false } = {},
): Promise<YouTubePlaylist> => {
    const query = `id=${encodeURIComponent(listId)}${includeUnavailable ? '&includeUnavailable=true' : ''}`;
    const url = `${apiBase.replace(/\/+$/, '')}/playlist?${query}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let res: Response;
    try {
        res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    } catch {
        throw new PlaylistImportError(
            typeof navigator !== 'undefined' && navigator.onLine === false
                ? "You're offline. Importing a playlist needs a connection."
                : "Can't reach the API to read the playlist. Is it running?",
        );
    } finally {
        clearTimeout(timer);
    }

    let body: (Partial<YouTubePlaylist> & { error?: string }) | null = null;
    try {
        body = await res.json();
    } catch {
        /* not JSON: handled below */
    }
    if (res.status === 404) {
        throw new PlaylistImportError(
            body?.error ? capitalize(body.error) : "That playlist wasn't found. It may be private.",
        );
    }
    if (!res.ok || !body || !Array.isArray(body.videos)) {
        throw new PlaylistImportError(body?.error ? capitalize(body.error) : "YouTube didn't return the playlist.");
    }
    return body as YouTubePlaylist;
};

/** Shown when YouTube only returned part of a playlist (no API key on the server). */
export const PARTIAL_IMPORT_NOTE =
    'Only the latest videos could be read. Set YOUTUBE_API_KEY on the API to import whole playlists.';

/** YouTube only lists deleted and private videos to the Data API, which needs a key. */
export const UNAVAILABLE_NEEDS_KEY_NOTE = 'Deleted videos can only be imported when YOUTUBE_API_KEY is set on the API';
