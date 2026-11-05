import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import SyncIcon from '@mui/icons-material/Sync';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
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
        if (status === 'error') return styles.failed;
        return pending > 0 ? styles.waiting : styles.synced;
    };

    return (
        <div className={styles.status}>
            <button
                type="button"
                className={styles.summary}
                title={error ?? 'Sync settings'}
                onClick={() => {
                    dispatch(toggleSidebar(false));
                    dispatch(openSettings());
                }}
            >
                <span className={[styles.dot, tone(), syncing && styles.pulse].filter(Boolean).join(' ')} />
                <span className={styles.text}>{label()}</span>
                <SettingsOutlined fontSize="small" />
            </button>
            {configured && (
                <IconButton
                    size="small"
                    color="inherit"
                    className={styles.now}
                    title="Sync now"
                    aria-label="Sync now"
                    disabled={syncing}
                    onClick={() => dispatch(syncNow())}
                >
                    {syncing ? <CircularProgress size={14} color="inherit" /> : <SyncIcon fontSize="small" />}
                </IconButton>
            )}
        </div>
    );
};
