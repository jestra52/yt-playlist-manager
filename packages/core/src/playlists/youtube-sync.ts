/**
 * Compares a playlist with its YouTube playlist, as /api/playlist returns it
 * when read with `includeUnavailable` (deleted and private videos in their
 * place, flagged). Only videos with a YouTube ID take part; placeholders from
 * old reports are left alone. A video whose link was changed in the app still
 * counts as the video it replaced, so that one isn't offered back.
 *
 * Returns:
 *   complete        true when YouTube returned the whole playlist (read with an
 *                   API key, not cut short), so videos missing from it were really removed
 *   added           videos new on YouTube, in YouTube's order, each with `afterId`:
 *                   the playlist video that comes before it on YouTube (null at the start)
 *   nowUnavailable  playlist videos deleted or made private on YouTube since
 *   availableAgain  playlist videos marked deleted that YouTube lists normally again
 *   removed         playlist videos no longer in the YouTube playlist (empty unless complete)
 *
 * Deleted videos the playlist doesn't have yet are only `added` with
 * `includeUnavailable`, as Missing items.
 */
export interface LocalVideo {
    id: string;
    youtubeId: string;
    replacedYoutubeId?: string;
    unavailable?: boolean;
}

export interface SourceVideo {
    youtubeId: string;
    title?: string;
    author?: string;
    thumbnailUrl?: string;
    unavailable?: boolean;
}

export interface SourcePlaylist {
    source?: string;
    partial?: boolean;
    videos: SourceVideo[];
}

export interface YouTubeDiff<V extends LocalVideo = LocalVideo> {
    complete: boolean;
    added: (SourceVideo & { unavailable: boolean; afterId: string | null })[];
    nowUnavailable: V[];
    availableAgain: V[];
    removed: V[];
}

export const diffWithYouTube = <V extends LocalVideo>(
    videos: readonly V[],
    source: SourcePlaylist,
    { includeUnavailable = false } = {},
): YouTubeDiff<V> => {
    const local = new Map<string, V>();
    const replaced = new Map<string, V>();
    for (const video of videos) {
        if (video.youtubeId && !local.has(video.youtubeId)) local.set(video.youtubeId, video);
        if (video.replacedYoutubeId) replaced.set(video.replacedYoutubeId, video);
    }
    const onYouTube = new Set(source.videos.map((item) => item.youtubeId));
    const complete = source.source === 'api' && !source.partial;

    const added: YouTubeDiff<V>['added'] = [];
    const nowUnavailable: V[] = [];
    const availableAgain: V[] = [];
    const seen = new Set<string>();
    let afterId: string | null = null;
    for (const item of source.videos) {
        if (seen.has(item.youtubeId)) continue;
        seen.add(item.youtubeId);
        const video = local.get(item.youtubeId);
        if (video) {
            afterId = video.id;
            if (item.unavailable && !video.unavailable) nowUnavailable.push(video);
            if (!item.unavailable && video.unavailable) availableAgain.push(video);
            continue;
        }
        const replacement = replaced.get(item.youtubeId);
        if (replacement) {
            afterId = replacement.id;
            continue;
        }
        if (item.unavailable && !includeUnavailable) continue;
        added.push({
            ...item,
            unavailable: Boolean(item.unavailable),
            afterId,
        });
    }

    const removed = complete
        ? [...local.values()].filter(
              (video) => !onYouTube.has(video.youtubeId) && !onYouTube.has(video.replacedYoutubeId ?? ''),
          )
        : [];
    return { complete, added, nowUnavailable, availableAgain, removed };
};

/** True when applying the comparison would change something. */
export const hasChanges = (diff: YouTubeDiff, { removeMissing = false } = {}): boolean => {
    return (
        diff.added.length > 0 ||
        diff.nowUnavailable.length > 0 ||
        diff.availableAgain.length > 0 ||
        (removeMissing && diff.removed.length > 0)
    );
};
