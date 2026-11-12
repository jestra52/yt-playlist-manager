import { toCredits, type ArtistCredit } from '../videos/artist-credits';
import { parseYouTubeId } from '../videos/youtube';
import { JSON_REPORT_FORMAT, JSON_REPORT_VERSION } from './report';

/**
 * Report formats (see report.js). Reports without a `Format:` line are legacy
 * ones: the whole text after `number:` is the title, even when it contains
 * ` | `. With it, the artist follows the last ` | `. JSON reports also keep each
 * video's link, channel and notes, and each of its artists when it has several.
 * Old ones also have a `watched` field, which is ignored.
 */
export const FORMATS = {
    legacy: 'legacy',
    artists: 'artists',
    json: 'json',
} as const;

export type ReportFormat = (typeof FORMATS)[keyof typeof FORMATS];

export interface ReportEntry {
    number: number;
    title: string;
    artist: string;
    youtubeId: string | null;
    /** Only in JSON reports. */
    artists?: ArtistCredit[];
    author?: string;
    notes?: string;
    unavailable?: boolean;
}

export interface ParsedReport {
    format: ReportFormat;
    entries: ReportEntry[];
    /** Why a JSON report can't be read. It has no entries then. */
    error?: string;
}

export interface ComparedVideo {
    id: string;
    title?: string;
    artist?: string;
    youtubeId?: string;
}

export interface MissingEntry extends ReportEntry {
    afterId: string | null;
}

export interface ReportComparison {
    format: ReportFormat;
    total: number;
    found: number;
    missing: MissingEntry[];
}

const NUMBERED = /^\s*(\d+)\s*[:.)]\s*(.*\S)\s*$/u;
const FORMAT = /^\s*Format\s*:/iu;
// Greedy, so the split is at the last " |"; the artist may be empty.
const WITH_ARTIST = /^(.*)\s\|(?:\s+(.*))?$/u;

const refused = (error: string): ParsedReport => ({ format: FORMATS.json, entries: [], error });

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const jsonEntry = (video: unknown, index: number): ReportEntry | null => {
    if (!isRecord(video)) return null;
    const id = text(video.youtubeId);
    const youtubeId = id ? parseYouTubeId(id) : null;
    if ((id && !youtubeId) || (!id && !text(video.title))) return null;
    const artists = toCredits(video.artists);
    return {
        ...(artists.length && { artists }),
        number: index + 1,
        title: text(video.title),
        artist: text(video.artist),
        youtubeId,
        author: text(video.author),
        notes: text(video.notes),
        unavailable: video.unavailable === true,
    };
};

const parseJsonReport = (source: string): ParsedReport => {
    let report: unknown;
    try {
        report = JSON.parse(source);
    } catch {
        return refused("This file isn't valid JSON.");
    }
    if (!isRecord(report) || report.format !== JSON_REPORT_FORMAT) {
        return refused("This JSON file isn't a report from this app.");
    }
    if (typeof report.version !== 'number' || report.version > JSON_REPORT_VERSION) {
        return refused('This report is from a newer version of the app.');
    }
    const entries = Array.isArray(report.videos) ? report.videos.map(jsonEntry) : [null];
    if (entries.includes(null)) return refused("This report is damaged: a video in it can't be read.");
    return { format: FORMATS.json, entries: entries as ReportEntry[] };
};

/**
 * Reads a report: its format and every `number: title` line, in order. The
 * "Total videos" line and anything else that isn't numbered is ignored. A
 * title that is a YouTube link (reports use one for videos without a title)
 * comes back with its `youtubeId`.
 *
 * Returns { format, entries: [{ number, title, artist, youtubeId }] }; `artist`
 * is '' in legacy reports and when the report doesn't know it. A JSON report that
 * can't be read comes back with no entries and an `error`.
 */
export const parseReport = (source: string | null | undefined): ParsedReport => {
    const clean = (source ?? '').replace(/^\uFEFF/, '');
    if (clean.trimStart().startsWith('{')) return parseJsonReport(clean);
    const lines = clean.split(/\r?\n/);
    const format = lines.some((line) => FORMAT.test(line)) ? FORMATS.artists : FORMATS.legacy;
    const entries: ReportEntry[] = [];
    for (const line of lines) {
        const match = line.match(NUMBERED);
        if (!match) continue;
        let title = match[2]!;
        let artist = '';
        const split = format === FORMATS.artists ? title.match(WITH_ARTIST) : null;
        if (split && split[1]!.trim()) {
            title = split[1]!.trim();
            artist = (split[2] ?? '').trim();
        }
        const youtubeId = /^https?:\/\//i.test(title) ? parseYouTubeId(title) : null;
        entries.push({ number: Number(match[1]), title, artist, youtubeId });
    }
    return { format, entries };
};

/**
 * Key two titles share when they only differ in case, spacing, punctuation or
 * full-width characters, e.g. "MAKOTO MATUSHITA FIRST LIGHT" and "Makoto Matushita - First Light".
 */
export const titleKey = (title: string | null | undefined): string =>
    (title ?? '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '');

const push = (map: Map<string, string[]>, key: string | undefined, id: string): void => {
    if (key) map.set(key, [...(map.get(key) ?? []), id]);
};

/**
 * Finds which report entries the playlist no longer has. Each video can match
 * one entry only, so a title listed twice needs two videos.
 *
 * - Legacy reports match by title. A title that is the video's
 *   "artist - title" or "title - artist" matches too, so reports saved before
 *   a title was cleaned up still match.
 * - Reports with artists match by title, and prefer the video with the same
 *   artist when several share a title.
 * - JSON reports match by YouTube ID, and by title for placeholders.
 *
 * Missing entries carry `afterId`: the playlist video matched by the closest
 * earlier entry (null when none), so they can go back near their old place.
 *
 * Returns { format, total, found, missing: [{ number, title, artist, youtubeId, afterId }] }.
 */
export const compareReport = (
    { format, entries }: ParsedReport,
    videos: readonly ComparedVideo[],
): ReportComparison => {
    const byTitle = new Map<string, string[]>();
    const byArtistAndTitle = new Map<string, string[]>();
    const byYouTubeId = new Map<string, string[]>();
    const artistOf = new Map<string, string>();
    for (const video of videos) {
        push(byTitle, titleKey(video.title), video.id);
        push(byYouTubeId, video.youtubeId, video.id);
        const artist = titleKey(video.artist);
        artistOf.set(video.id, artist);
        if (artist && titleKey(video.title)) {
            push(byArtistAndTitle, artist + titleKey(video.title), video.id);
            push(byArtistAndTitle, titleKey(video.title) + artist, video.id);
        }
    }

    const used = new Set<string>();
    const take = (
        map: Map<string, string[]>,
        key: string | null,
        prefer: (id: string) => boolean = () => false,
    ): string | null => {
        const free = (key ? map.get(key) : undefined)?.filter((id) => !used.has(id)) ?? [];
        const id = free.find(prefer) ?? free[0] ?? null;
        if (id) used.add(id);
        return id;
    };

    const match = (entry: ReportEntry): string | null => {
        if (entry.youtubeId) return take(byYouTubeId, entry.youtubeId);
        const key = titleKey(entry.title);
        if (format !== FORMATS.legacy) {
            const artist = titleKey(entry.artist);
            return take(byTitle, key, (id) => artist !== '' && artistOf.get(id) === artist);
        }
        return take(byTitle, key) ?? take(byArtistAndTitle, key);
    };

    const missing: MissingEntry[] = [];
    let afterId: string | null = null;
    for (const entry of entries) {
        const matchId = match(entry);
        if (matchId) afterId = matchId;
        else missing.push({ ...entry, afterId });
    }
    return {
        format,
        total: entries.length,
        found: entries.length - missing.length,
        missing,
    };
};
