import { parseYouTubeId } from '../videos/youtube.js';

/**
 * Reads an old report (see report.js): every `number: title` line, in order.
 * The "Total videos" line and anything else that isn't numbered is ignored.
 * A title that is a YouTube link (reports use one for videos without a title)
 * comes back with its `youtubeId`.
 */
export const parseReport = (text) => {
    const entries = [];
    for (const line of (text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
        const match = line.match(/^\s*(\d+)\s*[:.)]\s*(.*\S)\s*$/u);
        if (!match) continue;
        const title = match[2];
        const youtubeId = /^https?:\/\//i.test(title) ? parseYouTubeId(title) : null;
        entries.push({ number: Number(match[1]), title, youtubeId });
    }
    return entries;
};

/**
 * Key two titles share when they only differ in case, spacing, punctuation or
 * full-width characters, e.g. "MAKOTO MATUSHITA FIRST LIGHT" and "Makoto Matushita - First Light".
 */
export const titleKey = (title) =>
    (title ?? '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Finds which report entries the playlist no longer has. Each video can match
 * one entry only, so a title listed twice needs two videos. Missing entries
 * carry `afterId`: the playlist video matched by the closest earlier entry
 * (null when none), so they can go back near their old place.
 *
 * Returns { total, found, missing: [{ number, title, youtubeId, afterId }] }.
 */
export const compareReport = (entries, videos) => {
    const byTitle = new Map();
    const byYouTubeId = new Map();
    for (const video of videos) {
        const key = titleKey(video.title);
        if (key) byTitle.set(key, [...(byTitle.get(key) ?? []), video.id]);
        if (video.youtubeId) byYouTubeId.set(video.youtubeId, [...(byYouTubeId.get(video.youtubeId) ?? []), video.id]);
    }
    const used = new Set();
    const take = (map, key) => {
        const id = (key ? map.get(key) : undefined)?.find((candidate) => !used.has(candidate)) ?? null;
        if (id) used.add(id);
        return id;
    };

    const missing = [];
    let afterId = null;
    for (const entry of entries) {
        const matchId = entry.youtubeId ? take(byYouTubeId, entry.youtubeId) : take(byTitle, titleKey(entry.title));
        if (matchId) afterId = matchId;
        else missing.push({ ...entry, afterId });
    }
    return { total: entries.length, found: entries.length - missing.length, missing };
};
