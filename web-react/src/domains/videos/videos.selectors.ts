import { createSelector } from '@reduxjs/toolkit';
import { knownArtists } from '@ytpm/core/videos/artist';
import type { Video } from '@ytpm/core/videos/videos.repository';
import type { RootState } from '../../app/store';
import { videosAdapter, type VideoFilter } from './videos.slice';

const selectors = videosAdapter.getSelectors((state: RootState) => state.videos);

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

export const selectAllVideos = selectors.selectAll;
export const selectVideoById = selectors.selectById;
export const selectFilter = (state: RootState) => state.videos.filter;
export const selectQuery = (state: RootState) => state.videos.query;
export const selectPlayingId = (state: RootState) => state.videos.playingId;
export const selectPlaying = (state: RootState) =>
    state.videos.playingId ? (state.videos.entities[state.videos.playingId] ?? null) : null;

export const selectVideoIdsFor = createSelector(
    [selectors.selectAll, (_: RootState, playlistId: string) => playlistId],
    (videos, playlistId) => videos.filter((v) => v.playlistId === playlistId).map((v) => v.id),
    { memoizeOptions: { resultEqualityCheck: sameIds } },
);

const matchesFilter = (video: Video, filter: VideoFilter): boolean => {
    if (filter === 'watched') return video.watched;
    if (filter === 'unwatched') return !video.watched;
    if (filter === 'missing') return video.missing;
    return true;
};

const matchesQuery = (video: Video, query: string): boolean =>
    !query ||
    video.title.toLowerCase().includes(query) ||
    video.artist.toLowerCase().includes(query) ||
    video.author.toLowerCase().includes(query) ||
    video.notes.toLowerCase().includes(query);

export interface VisibleVideos {
    total: number;
    rows: { id: string; index: number }[];
}

const sameVisible = (a: VisibleVideos, b: VisibleVideos) =>
    a.total === b.total &&
    a.rows.length === b.rows.length &&
    a.rows.every((row, i) => row.id === b.rows[i]?.id && row.index === b.rows[i]?.index);

/** The rows left after the filter and search; `index` is the video's place in the full playlist. */
export const selectVisibleVideos = createSelector(
    [selectors.selectAll, selectFilter, selectQuery, (_: RootState, playlistId: string) => playlistId],
    (videos, filter, query, playlistId): VisibleVideos => {
        const q = query.trim().toLowerCase();
        const all = videos.filter((v) => v.playlistId === playlistId);
        const rows = all
            .map((video, index) => ({ video, index }))
            .filter(({ video }) => matchesFilter(video, filter) && matchesQuery(video, q))
            .map(({ video, index }) => ({ id: video.id, index }));
        return { total: all.length, rows };
    },
    { memoizeOptions: { resultEqualityCheck: sameVisible } },
);

export const selectMissingCount = createSelector(
    [selectors.selectAll, (_: RootState, playlistId: string) => playlistId],
    (videos, playlistId) => videos.filter((v) => v.playlistId === playlistId && v.missing).length,
);

export interface Progress {
    left: number;
    total: number;
}

export const selectProgressByPlaylist = createSelector([selectors.selectAll], (videos) => {
    const progress: Record<string, Progress> = {};
    for (const video of videos) {
        const p = (progress[video.playlistId] ??= { left: 0, total: 0 });
        p.total++;
        if (!video.watched) p.left++;
    }
    return progress;
});

export const selectKnownArtists = createSelector([selectors.selectAll], (videos) => knownArtists(videos));
