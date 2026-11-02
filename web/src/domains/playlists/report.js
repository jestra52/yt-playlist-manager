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

import { cleanArtist } from '../videos/artist.js';

const EOL = '\r\n';

/** The header line that marks a report with artists. */
export const FORMAT_LINE = 'Format: number: title | artist';

const pad = (n) => String(n).padStart(2, '0');

const oneLine = (text) => {
    return (text ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim();
};

/** Builds the report text for videos already in playlist order. */
export const buildPlaylistReport = (videos) => {
    const lines = videos.map((video, i) => {
        const title = oneLine(video.title) || `https://youtu.be/${video.youtubeId}`;
        const artist = cleanArtist(video.artist);
        return `${i + 1}: ${title} |${artist ? ` ${artist}` : ''}`;
    });
    return [`Total videos: ${videos.length}`, FORMAT_LINE, ...lines].join(EOL);
};

/**
 * Lower-case, hyphen-separated file name part from a playlist name. Letters
 * and digits of any script are kept and Latin accents are dropped, so
 * "City Pop" is "city-pop" and Japanese names stay readable.
 */
export const slugify = (name) =>
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
export const reportFileName = (playlistName, date = new Date()) => {
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    return `${slugify(playlistName)}-report-${day}__${time}.txt`;
};
