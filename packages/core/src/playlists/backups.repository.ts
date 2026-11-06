import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import { newId, type Database } from '../db/index';
import { playlists, reports, type ReportRow } from '../db/tables';
import { buildJsonReport, type JsonReportVideo } from './report';

/** The same rules as the server: a playlist's first backup and its newest ones. */
const KEPT_PER_PLAYLIST = 10;
const DELETED_PLAYLIST_MS = 30 * 24 * 60 * 60 * 1000;

const trim = (db: Database, playlistId: string, at: number): void => {
    const ids = db.orm
        .select({ id: reports.id })
        .from(reports)
        .where(eq(reports.playlistId, playlistId))
        .orderBy(asc(reports.createdAt), asc(reports.id))
        .all()
        .map((row) => row.id);
    const extra = ids.slice(1, -KEPT_PER_PLAYLIST);
    if (extra.length) db.write(db.orm.delete(reports).where(inArray(reports.id, extra)));

    const gone = db.orm
        .select({ id: playlists.id })
        .from(playlists)
        .where(and(eq(playlists.deleted, true), lt(playlists.updatedAt, at - DELETED_PLAYLIST_MS)));
    db.write(db.orm.delete(reports).where(inArray(reports.playlistId, gone)));
};

/** Keeps a backup of a playlist's videos, given in playlist order. */
export const addBackup = (
    db: Database,
    playlist: { id: string; name: string },
    videos: readonly JsonReportVideo[],
    reason: string,
    date: Date = new Date(),
): ReportRow => {
    const row: ReportRow = {
        id: newId(),
        playlistId: playlist.id,
        playlistName: playlist.name,
        reason,
        videoCount: videos.length,
        content: JSON.stringify(buildJsonReport(playlist.name, videos, date)),
        createdAt: date.getTime(),
    };
    db.transaction(() => {
        db.write(db.orm.insert(reports).values(row));
        trim(db, playlist.id, row.createdAt);
    });
    return row;
};

/** The backups kept on this device, oldest first. */
export const listBackups = (db: Database): ReportRow[] => {
    return db.orm.select().from(reports).orderBy(asc(reports.createdAt), asc(reports.id)).all();
};

export const removeBackup = (db: Database, id: string): void => {
    db.write(db.orm.delete(reports).where(eq(reports.id, id)));
};
