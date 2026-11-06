import { getDatabase } from '@ytpm/core/db/index';
import { addBackup, listBackups, removeBackup } from '@ytpm/core/playlists/backups.repository';
import { postReport } from '@ytpm/core/sync/sync.client';
import type { AppThunk } from '../../app/store';
import { selectConfigured, selectSyncSettings } from '../sync/sync.selectors';
import { selectAllVideos } from '../videos/videos.selectors';

let uploading: Promise<void> | null = null;

const upload = (): AppThunk<Promise<void>> => async (_dispatch, getState) => {
    const db = getDatabase();
    const connection = selectSyncSettings(getState());
    for (const backup of listBackups(db)) {
        try {
            await postReport(connection, backup);
        } catch {
            // It stays on this device, and the next sync tries again.
            return;
        }
        removeBackup(db, backup.id);
    }
};

/** Sends the backups kept on this device to its sync chain, if it's in one. */
export const uploadBackups = (): AppThunk<Promise<void>> => (dispatch, getState) => {
    if (!selectConfigured(getState())) return Promise.resolve();
    uploading ??= dispatch(upload()).finally(() => {
        uploading = null;
    });
    return uploading;
};

/** Backs up a playlist as it is now. There's nothing to back up in an empty one. */
export const saveBackup =
    (playlist: { id: string; name: string }, reason: 'added' | 'download'): AppThunk =>
    (dispatch, getState) => {
        const videos = selectAllVideos(getState()).filter((v) => v.playlistId === playlist.id);
        if (!videos.length) return;
        addBackup(getDatabase(), playlist, videos, reason);
        void dispatch(uploadBackups());
    };
