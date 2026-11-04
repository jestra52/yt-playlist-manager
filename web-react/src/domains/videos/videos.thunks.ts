import { getDatabase } from '@ytpm/core/db/index';
import { addVideos, updateVideo } from '@ytpm/core/videos/videos.repository';
import { extractYouTubeIds } from '@ytpm/core/videos/youtube';
import type { AppThunk } from '../../app/store';
import { changed, upserted } from './videos.slice';

export interface AddResult {
    added: number;
    skipped: number;
    invalid: number;
}

/**
 * Adds the videos linked in `text` to a playlist. Playlist links and titles
 * from YouTube come in a later step; for now each video keeps its link.
 */
export const addVideosFromText =
    (playlistId: string, text: string): AppThunk<AddResult> =>
    (dispatch) => {
        const { ids, invalid } = extractYouTubeIds(text);
        const { added, skipped } = addVideos(getDatabase(), playlistId, ids);
        if (added.length) dispatch(upserted(added));
        return { added: added.length, skipped: skipped.length, invalid: invalid.length };
    };

export const setWatched =
    (id: string, watched: boolean): AppThunk =>
    (dispatch) => {
        const video = updateVideo(getDatabase(), id, { watched });
        if (video) dispatch(changed(video));
    };
