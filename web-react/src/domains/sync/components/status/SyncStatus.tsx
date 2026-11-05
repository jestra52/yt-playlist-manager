import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { timeAgo } from '../../../../shared/time';
import { useNow } from '../../../../shared/useNow';
import { openSettings, toggleSidebar } from '../../../ui/ui.slice';
import { selectConfigured, selectSync } from '../../sync.selectors';
import { syncNow } from '../../sync.thunks';
import styles from './SyncStatus.module.scss';

export const SyncStatus = () => {
    const { status, offline, pending, lastSyncedAt, error } = useAppSelector(selectSync);
    const configured = useAppSelector(selectConfigured);
    const dispatch = useAppDispatch();
    const now = useNow(30_000);
    const syncing = status === 'syncing';

    const label = () => {
        if (!configured) return 'Only on this device';
        if (syncing) return 'Syncing…';
        if (status === 'error') return offline ? 'Offline. Changes are saved here.' : 'Sync failed';
        if (pending > 0) return `${pending} change${pending === 1 ? '' : 's'} to sync`;
        return `Synced ${timeAgo(lastSyncedAt, now)}`;
    };

    const tone = () => {
        if (!configured) return styles.idle;
        if (status === 'error') return 'status-error';
        return pending > 0 ? 'status-warning' : 'status-success';
    };

    return (
        <div className={`flex gap-1 pt-3 ${styles.bar}`}>
            <button
                type="button"
                className="btn btn-ghost btn-sm min-w-0 flex-1 justify-start gap-2 px-2 font-normal"
                title={error ?? 'Sync settings'}
                onClick={() => {
                    dispatch(toggleSidebar(false));
                    dispatch(openSettings());
                }}
            >
                <span className={`status ${tone()} ${syncing ? 'animate-pulse' : ''}`} aria-hidden="true" />
                <span className="grow truncate text-left">{label()}</span>
                <Icon name="settings" size={16} />
            </button>
            {configured && (
                <button
                    className="btn btn-ghost btn-sm btn-square"
                    type="button"
                    title="Sync now"
                    aria-label="Sync now"
                    disabled={syncing}
                    onClick={() => dispatch(syncNow())}
                >
                    {syncing ? <span className="loading loading-spinner loading-xs" /> : <Icon name="sync" size={16} />}
                </button>
            )}
        </div>
    );
};
