import { createSelector } from '@reduxjs/toolkit';
import { knownCreditNames } from '@ytpm/core/videos/artist-credits';
import type { Video } from '@ytpm/core/videos/videos.repository';
import type { RootState } from '../../app/store';
import { videosAdapter, type VideoFilter, type VideoSort } from './videos.slice';

const selectors = videosAdapter.getSelectors((state: RootState) => state.videos);

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

export const selectAllVideos = selectors.selectAll;
export const selectVideoById = selectors.selectById;
export const selectFilter = (state: RootState) => state.videos.filter;
export const selectQuery = (state: RootState) => state.videos.query;
export const selectSort = (state: RootState) => state.videos.sort;
export const selectPlayingId = (state: RootState) => state.videos.playingId;
export const selectPlaying = (state: RootState) =>
    state.videos.playingId ? (state.videos.entities[state.videos.playingId] ?? null) : null;

export const selectVideoIdsFor = createSelector(
    [selectors.selectAll, (_: RootState, playlistId: string) => playlistId],
    (videos, playlistId) => videos.filter((v) => v.playlistId === playlistId).map((v) => v.id),
    { memoizeOptions: { resultEqualityCheck: sameIds } },
);

const matchesFilter = (video: Video, filter: VideoFilter): boolean => filter !== 'missing' || video.missing;

const matchesQuery = (video: Video, query: string): boolean =>
    !query ||
    video.title.toLowerCase().includes(query) ||
    video.artist.toLowerCase().includes(query) ||
    video.author.toLowerCase().includes(query) ||
    video.notes.toLowerCase().includes(query);

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const shownTitle = (video: Video) => video.title || (video.missing ? 'Untitled' : video.youtubeId);

const comparers: Record<Exclude<VideoSort, 'default'>, (a: Video, b: Video) => number> = {
    artist: (a, b) =>
        Number(!a.artist) - Number(!b.artist) ||
        collator.compare(a.artist, b.artist) ||
        collator.compare(shownTitle(a), shownTitle(b)),
    title: (a, b) => collator.compare(shownTitle(a), shownTitle(b)),
    missing: (a, b) => Number(b.missing) - Number(a.missing),
};

const sortRows = <T extends { video: Video; index: number }>(rows: T[], sort: VideoSort): T[] => {
    if (sort === 'default') return rows;
    const compare = comparers[sort];
    return rows.sort((a, b) => compare(a.video, b.video) || a.index - b.index);
};

export interface VisibleVideos {
    total: number;
    rows: { id: string; index: number }[];
}

const sameVisible = (a: VisibleVideos, b: VisibleVideos) =>
    a.total === b.total &&
    a.rows.length === b.rows.length &&
    a.rows.every((row, i) => row.id === b.rows[i]?.id && row.index === b.rows[i]?.index);

/** The rows left after the filter and search, in the chosen sort; `index` is the video's place in the full playlist. */
export const selectVisibleVideos = createSelector(
    [selectors.selectAll, selectFilter, selectQuery, selectSort, (_: RootState, playlistId: string) => playlistId],
    (videos, filter, query, sort, playlistId): VisibleVideos => {
        const q = query.trim().toLowerCase();
        const all = videos.filter((v) => v.playlistId === playlistId);
        const matching = all
            .map((video, index) => ({ video, index }))
            .filter(({ video }) => matchesFilter(video, filter) && matchesQuery(video, q));
        const rows = sortRows(matching, sort).map(({ video, index }) => ({ id: video.id, index }));
        return { total: all.length, rows };
    },
    { memoizeOptions: { resultEqualityCheck: sameVisible } },
);

export const selectMissingCount = createSelector(
    [selectors.selectAll, (_: RootState, playlistId: string) => playlistId],
    (videos, playlistId) => videos.filter((v) => v.playlistId === playlistId && v.missing).length,
);

export const selectVideoCounts = createSelector([selectors.selectAll], (videos) => {
    const counts: Record<string, number> = {};
    for (const video of videos) counts[video.playlistId] = (counts[video.playlistId] ?? 0) + 1;
    return counts;
});

const selectShuffle = (state: RootState) => state.videos.shuffle;

export const selectShuffleOn = (state: RootState) => {
    const shuffle = selectShuffle(state);
    return shuffle !== null && shuffle.playlistId === selectPlaying(state)?.playlistId;
};

/** The playing video's playlist without Missing videos, in its own order. */
export const selectPlaylistQueue = createSelector([selectors.selectAll, selectPlaying], (videos, playing) =>
    videos.filter((v) => v.playlistId === playing?.playlistId && (!v.missing || v.id === playing.id)),
);

/** What Previous and Next move through: the playlist's order, or the shuffled one. */
const selectPlayQueue = createSelector([selectPlaylistQueue, selectShuffle], (queue, shuffle) => {
    if (!shuffle || shuffle.playlistId !== queue[0]?.playlistId) return queue;
    const byId = new Map(queue.map((v) => [v.id, v]));
    return shuffle.ids.flatMap((id) => byId.get(id) ?? []);
});

const selectPlayingPlace = createSelector([selectPlayQueue, selectPlayingId], (queue, playingId) =>
    queue.findIndex((v) => v.id === playingId),
);

export const selectNextVideo = (state: RootState) => selectPlayQueue(state)[selectPlayingPlace(state) + 1] ?? null;
export const selectPreviousVideo = (state: RootState) => selectPlayQueue(state)[selectPlayingPlace(state) - 1] ?? null;

export const selectKnownArtists = createSelector([selectors.selectAll], (videos) => knownCreditNames(videos));
