import { useEffect, useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import {
    downloadBackup,
    listPlaylistBackups,
    readBackup,
    type Backup,
    type BackupList as Backups,
} from '../../backups.thunks';

interface BackupListProps {
    playlistId: string;
    onLoad: (report: string, label: string) => void;
}

const REASONS: Record<string, string> = { added: 'When added', download: 'Report downloaded' };

const dateOf = (backup: Backup) => new Date(backup.createdAt).toLocaleString();

export const BackupList = ({ playlistId, onLoad }: BackupListProps) => {
    const [list, setList] = useState<Backups | null>(null);
    const dispatch = useAppDispatch();

    useEffect(() => {
        let current = true;
        void dispatch(listPlaylistBackups(playlistId)).then((result) => {
            if (current) setList(result);
        });
        return () => {
            current = false;
        };
    }, [dispatch, playlistId]);

    const load = async (backup: Backup) => {
        const report = await dispatch(readBackup(backup));
        if (report) onLoad(report, `Backup from ${dateOf(backup)}`);
    };

    return (
        <section className="mt-4" aria-label="Backups">
            <h3 className="m-0 text-sm font-semibold">Backups</h3>
            {!list && <span className="loading loading-spinner loading-xs mt-2" aria-label="Loading backups" />}
            {list && !list.complete && (
                <p className="text-base-content/65 mt-1 mb-0 text-sm">
                    Can't reach the server, so only this device's backups are listed.
                </p>
            )}
            {list?.backups.length === 0 && (
                <p className="text-base-content/65 mt-1 mb-0 text-sm">No backups of this playlist yet.</p>
            )}
            {list && list.backups.length > 0 && (
                <ul className="rounded-box border-base-300 m-0 mt-2 max-h-48 overflow-y-auto border p-0 text-sm">
                    {list.backups.map((backup) => (
                        <li key={backup.id} className="flex items-center gap-2 px-3 py-1.5">
                            <span className="min-w-0 flex-1">
                                {dateOf(backup)}
                                <span className="text-base-content/65 block">
                                    {REASONS[backup.reason] ?? backup.reason} · {backup.videoCount}{' '}
                                    {backup.videoCount === 1 ? 'video' : 'videos'}
                                </span>
                            </span>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                aria-label={`Compare with the backup from ${dateOf(backup)}`}
                                onClick={() => void load(backup)}
                            >
                                Compare
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost btn-square btn-sm"
                                title="Download"
                                aria-label={`Download the backup from ${dateOf(backup)}`}
                                onClick={() => void dispatch(downloadBackup(backup))}
                            >
                                <Icon name="download" size={16} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};
