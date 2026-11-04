/**
 * Where a video's artist came from, weakest first. A value from a source can
 * replace one from the same or a weaker source, so a hand edit is never
 * overwritten. A lookup service with real artist data (e.g. Spotify) slots in
 * as a new source between `guess` and `user`.
 */
export const ARTIST_SOURCES = ['', 'guess', 'user'] as const;

export type ArtistSource = (typeof ARTIST_SOURCES)[number];

export interface ArtistFields {
    artist?: string;
    artistSource?: string;
    title?: string;
    author?: string;
}

const rank = (source: string | undefined): number => {
    const i = (ARTIST_SOURCES as readonly string[]).indexOf(source ?? '');
    return i === -1 ? 0 : i;
};

/** True when an artist from `source` may replace the video's current one. */
export const canReplaceArtist = (video: ArtistFields | null | undefined, source: string): boolean => {
    return rank(source) >= rank(video?.artistSource);
};

/** One line, no stray spaces, and never the ` | ` that separates it in reports. */
export const cleanArtist = (artist: string | null | undefined): string => {
    return (artist ?? '')
        .replace(/\s*\|\s*/g, ' / ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
};

/** Key two spellings of an artist share when they only differ in case, spacing or full-width letters. */
export const artistKey = (artist: string | null | undefined): string => {
    return cleanArtist(artist).normalize('NFKC').toLowerCase();
};

/**
 * The distinct artists of these videos, most used first. When an artist is
 * spelled more than one way, its most used spelling stands for it.
 */
export const knownArtists = (videos: readonly { artist?: string }[]): string[] => {
    const byKey = new Map<string, Map<string, number>>();
    for (const { artist } of videos) {
        const key = artistKey(artist);
        if (!key) continue;
        const spellings = byKey.get(key) ?? new Map();
        spellings.set(artist!, (spellings.get(artist!) ?? 0) + 1);
        byKey.set(key, spellings);
    }
    return [...byKey.values()]
        .map((spellings) => {
            const [name] = [...spellings].sort((a, b) => b[1] - a[1])[0]!;
            const count = [...spellings.values()].reduce((sum, n) => sum + n, 0);
            return { name, count };
        })
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .map((a) => a.name);
};

/** `artist` in the spelling `known` already uses for it, so one artist keeps one spelling. */
export const matchKnownArtist = (artist: string | null | undefined, known: readonly string[]): string => {
    const clean = cleanArtist(artist);
    const key = artistKey(clean);
    return (key && known.find((name) => artistKey(name) === key)) || clean;
};

// YouTube Music's auto-generated channels: "Anri - Topic".
const TOPIC = /^(.+?)\s+-\s+Topic$/u;

// Bracketed extras that are never part of the artist or song name:
// "(Official Music Video)", "[MV]", "【Official Audio】", "(1983)".
const EXTRA_WORDS =
    /\b(official|music|video|mv|pv|audio|lyrics?|visuali[sz]er|hd|hq|4k|remaster(ed)?|full|version|ver|live|clip|subtitulado|sub)\b|^\s*\d{4}\s*$/iu;
const BRACKETS = /\s*[([【〔]([^)\]】〕]*)[)\]】〕]/gu;

const stripExtras = (title: string): string => {
    return title.replace(BRACKETS, (whole, inside: string) => (EXTRA_WORDS.test(inside) ? ' ' : whole)).trim();
};

// "Artist - Song", with a hyphen, en dash, em dash or slash between spaces, so
// names like "Jay-Z" or "AC/DC" aren't split.
const SEPARATOR = /\s+[-–—/／]\s+/u;
// "Artist「Song」" and "Artist『Song』", as Japanese uploads often write it.
const QUOTED = /^([^「『]+?)\s*[「『]/u;

const MAX_ARTIST = 80;

const plausible = (artist: string): boolean => {
    return artist.length > 0 && artist.length <= MAX_ARTIST && /[\p{L}\p{N}]/u.test(artist);
};

/**
 * Best guess at a video's artist from what YouTube tells us, or '' when there
 * is no safe guess:
 *   1. an auto-generated "Artist - Topic" channel
 *   2. a title like "Artist - Song", "Artist / Song" or "Artist「Song」",
 *      ignoring extras such as "(Official Music Video)" or "[MV]"
 */
export const guessArtist = ({ title = '', author = '' }: { title?: string; author?: string } = {}): string => {
    const topic = author.trim().match(TOPIC);
    if (topic && plausible(topic[1]!.trim())) return cleanArtist(topic[1]);

    const clean = stripExtras(title.replace(/\s+/g, ' ').trim());
    const parts = clean.split(SEPARATOR);
    if (parts.length >= 2 && parts.slice(1).join(' ').trim()) {
        const artist = parts[0]!.trim();
        if (plausible(artist)) return cleanArtist(artist);
    }
    const quoted = clean.match(QUOTED);
    if (quoted && plausible(quoted[1]!.trim())) return cleanArtist(quoted[1]);
    return '';
};

/**
 * The `{ artist, artistSource }` patch that applies a guess to a video, or an
 * empty patch when there is nothing to guess or the video's artist came from a
 * stronger source.
 */
export const guessedArtistPatch = (
    video: ArtistFields | null | undefined,
    { title = video?.title, author = video?.author }: { title?: string; author?: string } = {},
): { artist?: string; artistSource?: ArtistSource } => {
    if (!canReplaceArtist(video, 'guess')) return {};
    const artist = guessArtist({ title, author });
    if (!artist || artist === video?.artist) return {};
    return { artist, artistSource: 'guess' };
};
