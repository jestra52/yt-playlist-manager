/**
 * Plain-text playlist report: a total, then one numbered line per video in
 * playlist order. CRLF line endings so it reads the same in Windows Notepad.
 *
 *   Total videos: 2
 *   1: Mariya Takeuchi - Plastic Love
 *   2: Anri - Windy Summer
 */

const EOL = '\r\n';

const pad = (n) => String(n).padStart(2, '0');

/** Builds the report text for videos already in playlist order. */
export const buildPlaylistReport = (videos) => {
    const lines = videos.map((video, i) => {
        const title = video.title?.replace(/\s*[\r\n]+\s*/g, ' ').trim() || `https://youtu.be/${video.youtubeId}`;
        return `${i + 1}: ${title}`;
    });
    return [`Total videos: ${videos.length}`, ...lines].join(EOL);
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
        .replace(/[\u0300-\u036f]/g, '')
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
