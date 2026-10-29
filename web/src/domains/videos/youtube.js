const ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
// Bare playlist IDs we recognise without a link: user playlists (PL…) and album playlists (OLAK5uy_…).
const BARE_LIST_ID = /^(PL|OLAK5uy_)[A-Za-z0-9_-]{10,62}$/;
const HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
]);
const PATH_PREFIXES = ['embed', 'shorts', 'live', 'v', 'e'];

export function isYouTubeId(value) {
    return ID.test(value);
}

/**
 * Extracts the video ID from a YouTube link (watch, youtu.be, shorts, embed,
 * live, music) or a bare 11-character ID. Returns null when there is none.
 */
export function parseYouTubeId(input) {
    const raw = String(input ?? '').trim();
    if (!raw) return null;
    if (isYouTubeId(raw)) return raw;

    let url;
    try {
        url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
        return null;
    }
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);

    if (host === 'youtu.be' || host === 'www.youtu.be') {
        return isYouTubeId(parts[0] ?? '') ? parts[0] : null;
    }
    if (!HOSTS.has(host)) return null;

    const v = url.searchParams.get('v');
    if (v && isYouTubeId(v)) return v;
    if (parts.length >= 2 && PATH_PREFIXES.includes(parts[0]) && isYouTubeId(parts[1])) return parts[1];
    return null;
}

function toYouTubeUrl(raw) {
    try {
        const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        const host = url.hostname.toLowerCase();
        return HOSTS.has(host) || host === 'youtu.be' || host === 'www.youtu.be' ? url : null;
    } catch {
        return null;
    }
}

/**
 * Extracts the playlist ID from a YouTube playlist link
 * (youtube.com/playlist?list=…, or any watch link with a `list` parameter)
 * or a bare playlist ID such as PL…. Returns null when there is none.
 */
export function parsePlaylistId(input) {
    const raw = String(input ?? '').trim();
    if (!raw) return null;
    if (BARE_LIST_ID.test(raw)) return raw;
    const list = toYouTubeUrl(raw)?.searchParams.get('list');
    return list && LIST_ID.test(list) ? list : null;
}

/** The playlist ID of a link that points to a playlist rather than one video. */
function playlistOnlyId(token) {
    return parseYouTubeId(token) ? null : parsePlaylistId(token);
}

/**
 * Splits pasted text (one or many links, separated by spaces, commas or new
 * lines) into unique video IDs and playlist IDs, and reports what couldn't be
 * read. A watch link that also names a playlist counts as that one video.
 */
export function extractYouTubeIds(text) {
    const tokens = String(text ?? '')
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    const ids = [];
    const playlistIds = [];
    const invalid = [];
    for (const token of tokens) {
        const id = parseYouTubeId(token);
        const listId = id ? null : playlistOnlyId(token);
        if (id) {
            if (!ids.includes(id)) ids.push(id);
        } else if (listId) {
            if (!playlistIds.includes(listId)) playlistIds.push(listId);
        } else {
            invalid.push(token);
        }
    }
    return { ids, playlistIds, invalid };
}

export function thumbnailFor(youtubeId) {
    return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
}

export function watchUrl(youtubeId) {
    return `https://www.youtube.com/watch?v=${youtubeId}`;
}

export function embedUrl(youtubeId) {
    return `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`;
}
