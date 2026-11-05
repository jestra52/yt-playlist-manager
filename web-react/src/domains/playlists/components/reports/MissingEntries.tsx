import type { MissingEntry } from '@ytpm/core/playlists/report-compare';
import styles from './MissingEntries.module.scss';

export const MissingEntries = ({ entries }: { entries: MissingEntry[] }) => (
    <ol className={styles.list} aria-label="Missing items">
        {entries.map((entry) => (
            <li key={entry.number} className={styles.entry}>
                <span className={styles.number}>{entry.number}:</span>
                <span className={styles.title}>
                    {entry.title}
                    {entry.artist && <span className={styles.artist}> · {entry.artist}</span>}
                </span>
            </li>
        ))}
    </ol>
);
