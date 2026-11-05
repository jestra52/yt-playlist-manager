const ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
// Bare playlist IDs we recognise without a link: user playlists (PL…) and album playlists (OLAK5uy_…).
const BARE_LIST_ID = /^(PL|OLAK5uy_)[A-Za-z0-9_-]{10,62}$/;
export type ListKind = 'playlist' | 'mix' | 'private';

type ListRule = { kind: ListKind } & ({ id: string; prefix?: never } | { prefix: string; id?: never });

const LIST_RULES: ListRule[] = [
    { id: 'WL', kind: 'private' },
    { id: 'LL', kind: 'private' },
    { id: 'LM', kind: 'private' },
    { prefix: 'RDCLAK5uy_', kind: 'playlist' },
    { prefix: 'RD', kind: 'mix' },
];
const HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
]);
const PATH_PREFIXES = ['embed', 'shorts', 'live', 'v', 'e'];

export const isYouTubeId = (value: string): boolean => {
    return ID.test(value);
};

/**
 * Extracts the video ID from a YouTube link (watch, youtu.be, shorts, embed,
 * live, music) or a bare 11-character ID. Returns null when there is none.
 */
export const parseYouTubeId = (input: unknown): string | null => {
    const raw = String(input ?? '').trim();
    if (!raw) return null;
    if (isYouTubeId(raw)) return raw;

    let url: URL;
    try {
        url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
        return null;
    }
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);

    if (host === 'youtu.be' || host === 'www.youtu.be') {
        return isYouTubeId(parts[0] ?? '') ? parts[0]! : null;
    }
    if (!HOSTS.has(host)) return null;

    const v = url.searchParams.get('v');
    if (v && isYouTubeId(v)) return v;
    if (parts.length >= 2 && PATH_PREFIXES.includes(parts[0]!) && isYouTubeId(parts[1]!)) return parts[1]!;
    return null;
};

const toYouTubeUrl = (raw: string): URL | null => {
    try {
        const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        const host = url.hostname.toLowerCase();
        return HOSTS.has(host) || host === 'youtu.be' || host === 'www.youtu.be' ? url : null;
    } catch {
        return null;
    }
};

export const listKind = (listId: string): ListKind => {
    const rule = LIST_RULES.find((r) => (r.id ? listId === r.id : listId.startsWith(r.prefix!)));
    return rule?.kind ?? 'playlist';
};

export interface YouTubeList {
    id: string;
    kind: ListKind;
}

export const parseYouTubeList = (input: unknown): YouTubeList | null => {
    const raw = String(input ?? '').trim();
    if (!raw) return null;
    if (BARE_LIST_ID.test(raw)) return { id: raw, kind: 'playlist' };
    const url = toYouTubeUrl(raw);
    const list = url?.searchParams.get('list');
    if (!list || !(LIST_ID.test(list) || listKind(list) === 'private')) return null;
    return {
        id: list,
        kind: url!.searchParams.has('start_radio') ? 'mix' : listKind(list),
    };
};

/**
 * Extracts the playlist ID from a YouTube playlist link
 * (youtube.com/playlist?list=…, or any watch link with a `list` parameter)
 * or a bare playlist ID such as PL…. Returns null when there is none.
 */
export const parsePlaylistId = (input: unknown): string | null => {
    const list = parseYouTubeList(input);
    return list?.kind === 'playlist' ? list.id : null;
};

export const listProblem = (input: unknown): string | null => {
    const kind = parseYouTubeList(input)?.kind;
    if (kind === 'mix') return "That's a YouTube Mix, not a playlist. Mixes can't be imported";
    if (kind === 'private') return "That list is private to your YouTube account, so it can't be imported";
    return null;
};

/** The playlist ID of a link that points to a playlist rather than one video. */
const playlistOnlyId = (token: string): string | null => {
    return parseYouTubeId(token) ? null : parsePlaylistId(token);
};

export const videoInPlaylist = (input: unknown): { id: string; listId: string } | null => {
    const id = parseYouTubeId(input);
    const listId = id ? parsePlaylistId(input) : null;
    return id && listId ? { id, listId } : null;
};

/**
 * Splits pasted text (one or many links, separated by spaces, commas or new
 * lines) into unique video IDs and playlist IDs, and reports what couldn't be
 * read. A watch link that also names a playlist counts as that one video.
 */
export interface ExtractedIds {
    ids: string[];
    playlistIds: string[];
    invalid: string[];
    inPlaylist: number;
}

export const extractYouTubeIds = (text: unknown, { wholePlaylists = false } = {}): ExtractedIds => {
    const tokens = String(text ?? '')
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    const ids: string[] = [];
    const playlistIds: string[] = [];
    const invalid: string[] = [];
    let inPlaylist = 0;
    for (const token of tokens) {
        const fromList = videoInPlaylist(token);
        if (fromList) inPlaylist++;
        const id = fromList && wholePlaylists ? null : parseYouTubeId(token);
        const listId = id ? null : (fromList?.listId ?? playlistOnlyId(token));
        if (id) {
            if (!ids.includes(id)) ids.push(id);
        } else if (listId) {
            if (!playlistIds.includes(listId)) playlistIds.push(listId);
        } else {
            invalid.push(token);
        }
    }
    return { ids, playlistIds, invalid, inPlaylist };
};

export const thumbnailFor = (youtubeId: string): string => {
    return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
};

export const watchUrl = (youtubeId: string): string => {
    return `https://www.youtube.com/watch?v=${youtubeId}`;
};

export const embedUrl = (youtubeId: string): string => {
    return `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`;
};
