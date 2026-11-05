import CircularProgress from '@mui/material/CircularProgress';
import { describeEvent } from '@ytpm/core/sync/chain-events';
import { useAppSelector } from '../../../../app/store';
import styles from './ActivityTab.module.scss';

const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const ActivityTab = () => {
    const events = useAppSelector((state) => state.sync.events);

    if (!events) {
        return (
            <p className={styles.muted}>
                <CircularProgress size={14} color="inherit" /> Loading activity…
            </p>
        );
    }
    if (!events.length) return <p className={styles.muted}>Nothing yet.</p>;

    return (
        <ul className={styles.events}>
            {events.map((event) => (
                <li key={`${event.at}:${event.kind}:${event.deviceName}`} className={styles.event}>
                    <span>{describeEvent(event)}</span>
                    <time className={styles.time} dateTime={new Date(event.at).toISOString()}>
                        {formatter.format(new Date(event.at))}
                    </time>
                </li>
            ))}
        </ul>
    );
};
