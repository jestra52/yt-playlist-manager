const ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
// Bare playlist IDs we recognise without a link: user playlists (PL…) and album playlists (OLAK5uy_…).
const BARE_LIST_ID = /^(PL|OLAK5uy_)[A-Za-z0-9_-]{10,62}$/;
// Lists that only exist in the viewer's own YouTube account: Watch later, Liked videos, Liked music.
const PRIVATE_LISTS = new Set(['WL', 'LL', 'LM']);
// YouTube Music's curated playlists start with RD too, but they're real playlists.
const CURATED_PREFIX = 'RDCLAK5uy_';
const HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
]);
const PATH_PREFIXES = ['embed', 'shorts', 'live', 'v', 'e'];

export const isYouTubeId = (value) => {
    return ID.test(value);
};

/**
 * Extracts the video ID from a YouTube link (watch, youtu.be, shorts, embed,
 * live, music) or a bare 11-character ID. Returns null when there is none.
 */
export const parseYouTubeId = (input) => {
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
};

const toYouTubeUrl = (raw) => {
    try {
        const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        const host = url.hostname.toLowerCase();
        return HOSTS.has(host) || host === 'youtu.be' || host === 'www.youtu.be' ? url : null;
    } catch {
        return null;
    }
};

/**
 * What a `list` ID points to: 'mix' for YouTube's auto-generated Mixes (RD…,
 * endless and personal, so they can't be imported), 'private' for lists that
 * only exist in the viewer's account (Watch later, liked videos), otherwise
 * 'playlist'. The prefixes aren't documented by YouTube; keep them here.
 */
export const listKind = (listId) => {
    if (PRIVATE_LISTS.has(listId)) return 'private';
    if (listId.startsWith('RD') && !listId.startsWith(CURATED_PREFIX)) return 'mix';
    return 'playlist';
};

/**
 * Reads the `list` of a YouTube link (or a bare playlist ID such as PL…) and
 * what it points to (see listKind): { id, kind }, or null when there is none.
 * A link with `start_radio` is always a Mix.
 */
export const parseYouTubeList = (input) => {
    const raw = String(input ?? '').trim();
    if (!raw) return null;
    if (BARE_LIST_ID.test(raw)) return { id: raw, kind: 'playlist' };
    const url = toYouTubeUrl(raw);
    const list = url?.searchParams.get('list');
    if (!list || !(LIST_ID.test(list) || PRIVATE_LISTS.has(list))) return null;
    return { id: list, kind: url.searchParams.has('start_radio') ? 'mix' : listKind(list) };
};

/**
 * Extracts the playlist ID from a YouTube playlist link
 * (youtube.com/playlist?list=…, or any watch link with a `list` parameter)
 * or a bare playlist ID such as PL…. Returns null when there is none, and for
 * Mixes and private lists, which can't be imported (see listProblem).
 */
export const parsePlaylistId = (input) => {
    const list = parseYouTubeList(input);
    return list?.kind === 'playlist' ? list.id : null;
};

/** Why a link's list can't be imported or linked, or null when it can (or has no list). */
export const listProblem = (input) => {
    const kind = parseYouTubeList(input)?.kind;
    if (kind === 'mix') return 'That’s a YouTube Mix, not a playlist. Mixes can’t be imported';
    if (kind === 'private') return 'That list is private to your YouTube account, so it can’t be imported';
    return null;
};

/** The playlist ID of a link that points to a playlist rather than one video. */
const playlistOnlyId = (token) => {
    return parseYouTubeId(token) ? null : parsePlaylistId(token);
};

/**
 * Splits pasted text (one or many links, separated by spaces, commas or new
 * lines) into unique video IDs and playlist IDs, and reports what couldn't be
 * read. A watch link that also names a playlist counts as that one video.
 */
export const extractYouTubeIds = (text) => {
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
};

export const thumbnailFor = (youtubeId) => {
    return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
};

export const watchUrl = (youtubeId) => {
    return `https://www.youtube.com/watch?v=${youtubeId}`;
};

export const embedUrl = (youtubeId) => {
    return `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`;
};
