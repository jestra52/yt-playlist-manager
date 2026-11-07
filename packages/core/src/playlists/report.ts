/**
 * Plain-text playlist report: a total, a line naming the format, then one
 * numbered line per video in playlist order, with the artist after the last
 * ` | ` (empty when unknown). CRLF line endings so it reads the same in
 * Windows Notepad.
 *
 *   Total videos: 3
 *   Format: number: title | artist
 *   1: Plastic Love | Mariya Takeuchi
 *   2: Anri - Windy Summer | Anri
 *   3: Untitled live recording |
 *
 * Reports from before artists (no Format line, `number: title`) are still
 * read by report-compare.js.
 */

import { cleanArtist } from '../videos/artist';

export interface ReportVideo {
    title?: string;
    youtubeId: string;
    artist?: string;
}

const EOL = '\r\n';

/** What marks a JSON report, and the newest version of it this app reads. */
export const JSON_REPORT_FORMAT = 'yuzu-tapes-report';
export const JSON_REPORT_VERSION = 1;

export interface JsonReportVideo {
    youtubeId: string;
    title: string;
    artist: string;
    author: string;
    notes: string;
    unavailable: boolean;
}

export interface JsonReport {
    format: typeof JSON_REPORT_FORMAT;
    version: number;
    createdAt: string;
    playlist: { name: string };
    videos: JsonReportVideo[];
}

/** The header line that marks a report with artists. */
export const FORMAT_LINE = 'Format: number: title | artist';

const pad = (n: number): string => String(n).padStart(2, '0');

const oneLine = (text: string | null | undefined): string => {
    return (text ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim();
};

/** Builds the report text for videos already in playlist order. */
export const buildPlaylistReport = (videos: readonly ReportVideo[]): string => {
    const lines = videos.map((video, i) => {
        const title = oneLine(video.title) || `https://youtu.be/${video.youtubeId}`;
        const artist = cleanArtist(video.artist);
        return `${i + 1}: ${title} |${artist ? ` ${artist}` : ''}`;
    });
    return [`Total videos: ${videos.length}`, FORMAT_LINE, ...lines].join(EOL);
};

/** Builds a JSON report for videos already in playlist order. Unlike the text one, it can restore them. */
export const buildJsonReport = (
    playlistName: string,
    videos: readonly JsonReportVideo[],
    date: Date = new Date(),
): JsonReport => ({
    format: JSON_REPORT_FORMAT,
    version: JSON_REPORT_VERSION,
    createdAt: date.toISOString(),
    playlist: { name: playlistName },
    videos: videos.map(({ youtubeId, title, artist, author, notes, unavailable }) => ({
        youtubeId,
        title,
        artist,
        author,
        notes,
        unavailable,
    })),
});

/**
 * Lower-case, hyphen-separated file name part from a playlist name. Letters
 * and digits of any script are kept and Latin accents are dropped, so
 * "City Pop" is "city-pop" and Japanese names stay readable.
 */
export const slugify = (name: string | null | undefined): string =>
    (name ?? '')
        // NFKD turns full-width letters into plain ones and splits off accents;
        // NFC puts back the marks other scripts need (e.g. the dakuten in ポ).
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/, '') || 'playlist';

/** `city-pop-report-2023-06-06__00-52-33.txt`, in local time. */
export const reportFileName = (
    playlistName: string,
    date: Date = new Date(),
    extension: 'txt' | 'json' = 'txt',
): string => {
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    return `${slugify(playlistName)}-report-${day}__${time}.${extension}`;
};
