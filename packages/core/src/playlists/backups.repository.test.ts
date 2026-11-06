import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../db/database';
import { addBackup, listBackups, removeBackup } from './backups.repository';
import * as playlists from './playlists.repository';

let SQL: SqlJsStatic;

beforeAll(async () => {
    SQL = await initSqlJs();
});

const freshDb = () => new Database(new SQL.Database());
const playlist = { id: 'p1', name: 'House' };
const video = {
    youtubeId: 'aaaaaaaaaaa',
    title: 'Lady',
    artist: 'Modjo',
    author: '',
    notes: '',
    watched: false,
    unavailable: false,
};

describe('backups', () => {
    it('keeps a JSON report of the videos', () => {
        const db = freshDb();
        const row = addBackup(db, playlist, [video], 'added', new Date(5000));
        expect(row).toMatchObject({
            playlistId: 'p1',
            playlistName: 'House',
            reason: 'added',
            videoCount: 1,
            createdAt: 5000,
        });
        expect(JSON.parse(listBackups(db)[0]!.content)).toMatchObject({ format: 'yuzu-tapes-report', videos: [video] });
    });

    it("keeps a playlist's first backup and the newest ones", () => {
        const db = freshDb();
        for (let at = 1; at <= 15; at++) addBackup(db, playlist, [video], 'download', new Date(at));
        addBackup(db, { id: 'p2', name: 'Other' }, [video], 'added', new Date(1));

        const kept = listBackups(db).filter((row) => row.playlistId === 'p1');
        expect(kept.map((row) => row.createdAt)).toEqual([1, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        expect(listBackups(db)).toHaveLength(12);
    });

    it('removes the backups of a playlist deleted over 30 days ago', () => {
        const db = freshDb();
        const { id } = playlists.createPlaylist(db, { name: 'Gone' })!;
        addBackup(db, { id, name: 'Gone' }, [video], 'added');
        playlists.deletePlaylist(db, id);

        addBackup(db, playlist, [video], 'added');
        expect(listBackups(db)).toHaveLength(2);

        addBackup(db, playlist, [video], 'added', new Date(Date.now() + 31 * 24 * 60 * 60 * 1000));
        expect(listBackups(db).map((row) => row.playlistId)).toEqual(['p1', 'p1']);
    });

    it('forgets a backup once it has been uploaded', () => {
        const db = freshDb();
        const row = addBackup(db, playlist, [video], 'added');
        removeBackup(db, row.id);
        expect(listBackups(db)).toEqual([]);
    });
});
