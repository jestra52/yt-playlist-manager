import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import { videosAdapter } from './videos.slice';

const selectors = videosAdapter.getSelectors((state: RootState) => state.videos);

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

export const selectVideoById = selectors.selectById;

export const selectVideoIdsFor = createSelector(
    [selectors.selectAll, (_: RootState, playlistId: string) => playlistId],
    (videos, playlistId) => videos.filter((v) => v.playlistId === playlistId).map((v) => v.id),
    { memoizeOptions: { resultEqualityCheck: sameIds } },
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
