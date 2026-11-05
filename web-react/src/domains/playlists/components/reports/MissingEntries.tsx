import type { MissingEntry } from '@ytpm/core/playlists/report-compare';
import styles from './MissingEntries.module.scss';

export const MissingEntries = ({ entries }: { entries: MissingEntry[] }) => (
    <ol className={`rounded-box border-base-300 m-0 mt-3 border p-0 text-sm ${styles.list}`} aria-label="Missing items">
        {entries.map((entry) => (
            <li key={entry.number} className="flex gap-2 px-3 py-1.5">
                <span className="text-base-content/50 w-10 flex-none text-right tabular-nums">{entry.number}:</span>
                <span className="min-w-0 break-words">
                    {entry.title}
                    {entry.artist && <span className="text-base-content/65"> · {entry.artist}</span>}
                </span>
            </li>
        ))}
    </ol>
);
