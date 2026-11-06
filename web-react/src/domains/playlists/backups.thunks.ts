import { getDatabase } from '@ytpm/core/db/index';
import { addBackup, listBackups, removeBackup } from '@ytpm/core/playlists/backups.repository';
import type { ReportRow } from '@ytpm/core/db/tables';
import { reportFileName } from '@ytpm/core/playlists/report';
import { getReport, listReports, postReport } from '@ytpm/core/sync/sync.client';
import type { AppThunk } from '../../app/store';
import { downloadFile } from '../../shared/download';
import { selectConfigured, selectSyncSettings } from '../sync/sync.selectors';
import { notify } from '../ui/ui.slice';
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

/** A backup on this device has its `content`; one on the server is fetched when opened. */
export type Backup = Omit<ReportRow, 'content'> & { content?: string };

export interface BackupList {
    backups: Backup[];
    /** False when the server couldn't be asked, so only this device's backups are listed. */
    complete: boolean;
}

/** A playlist's backups on this device and in its chain, newest first. */
export const listPlaylistBackups =
    (playlistId: string): AppThunk<Promise<BackupList>> =>
    async (_dispatch, getState) => {
        const local: Backup[] = listBackups(getDatabase()).filter((row) => row.playlistId === playlistId);
        let remote: Backup[] = [];
        let complete = true;
        if (selectConfigured(getState())) {
            try {
                remote = await listReports(selectSyncSettings(getState()), playlistId);
            } catch {
                complete = false;
            }
        }
        const known = new Set(local.map((backup) => backup.id));
        const backups = [...local, ...remote.filter((backup) => !known.has(backup.id))];
        return { backups: backups.sort((a, b) => b.createdAt - a.createdAt), complete };
    };

/** A backup's JSON report as text, or null with a notice when it can't be fetched. */
export const readBackup =
    (backup: Backup): AppThunk<Promise<string | null>> =>
    async (dispatch, getState) => {
        if (backup.content) return backup.content;
        try {
            return JSON.stringify(await getReport(selectSyncSettings(getState()), backup.id), null, 2);
        } catch (err) {
            dispatch(notify((err as Error).message, { tone: 'error' }));
            return null;
        }
    };

/** Saves a backup as a file. It's already a backup, so this doesn't make another one. */
export const downloadBackup =
    (backup: Backup): AppThunk<Promise<void>> =>
    async (dispatch) => {
        const report = await dispatch(readBackup(backup));
        if (!report) return;
        const fileName = reportFileName(backup.playlistName, new Date(backup.createdAt), 'json');
        downloadFile(fileName, new Blob([report], { type: 'application/json' }));
        dispatch(notify(`Saved ${fileName}`));
    };
