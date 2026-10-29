import { thumbnailFor, watchUrl } from './youtube.js';

const fetchJson = async (url, timeoutMs) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (res.status === 404) return { notFound: true };
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Looks up a video's title and channel. Tries the app's Go API first (which
 * proxies YouTube oEmbed), then the public noembed.com service. Returns null
 * when neither is reachable, so the video keeps its placeholder title.
 */
export const fetchVideoMetadata = async (youtubeId, apiBase = '/api') => {
    const base = apiBase.replace(/\/+$/, '');
    const fromApi = await fetchJson(`${base}/oembed?id=${encodeURIComponent(youtubeId)}`, 5000);
    if (fromApi?.title) {
        return {
            title: fromApi.title,
            author: fromApi.author ?? '',
            thumbnailUrl: fromApi.thumbnailUrl || thumbnailFor(youtubeId),
        };
    }
    if (fromApi?.notFound) return { unavailable: true };

    const fromNoembed = await fetchJson(
        `https://noembed.com/embed?url=${encodeURIComponent(watchUrl(youtubeId))}`,
        5000,
    );
    if (fromNoembed?.title) {
        return {
            title: fromNoembed.title,
            author: fromNoembed.author_name ?? '',
            thumbnailUrl: thumbnailFor(youtubeId),
        };
    }
    return null;
};
