import { thumbnailFor, watchUrl } from './youtube';

export interface VideoMetadata {
    title: string;
    author: string;
    thumbnailUrl: string;
    unavailable?: undefined;
}

interface OembedReply {
    title?: string;
    author?: string;
    author_name?: string;
    thumbnailUrl?: string;
    notFound?: boolean;
}

const fetchJson = async (url: string, timeoutMs: number): Promise<OembedReply | null> => {
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
 * Looks up a video's title and channel. Tries the app's API first (which
 * proxies YouTube oEmbed), then the public noembed.com service. Returns null
 * when neither is reachable, so the video keeps its placeholder title.
 */
export const fetchVideoMetadata = async (
    youtubeId: string,
    apiBase = '/api',
): Promise<VideoMetadata | { unavailable: true } | null> => {
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
