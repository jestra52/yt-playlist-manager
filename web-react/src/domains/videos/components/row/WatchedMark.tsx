import { useAppDispatch } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { setWatched } from '../../videos.thunks';
import styles from './WatchedMark.module.scss';

interface WatchedMarkProps {
    id: string;
    number: number;
    title: string;
    watched: boolean;
}

const numberSize = (number: number) => {
    if (number >= 1000) return `${styles.number} ${styles.longer}`;
    return number >= 100 ? `${styles.number} ${styles.long}` : styles.number;
};

export const WatchedMark = ({ id, number, title, watched }: WatchedMarkProps) => {
    const dispatch = useAppDispatch();

    return (
        <button
            type="button"
            className={`btn btn-ghost btn-square btn-lg ${styles.mark}`}
            aria-pressed={watched}
            aria-label={watched ? `Mark "${title}" as not watched` : `Mark "${title}" as watched`}
            title={watched ? 'Watched. Click to undo' : 'Mark as watched'}
            onClick={() => dispatch(setWatched(id, !watched))}
        >
            {watched ? (
                <span className={styles.check}>
                    <Icon name="check" size={20} />
                </span>
            ) : (
                <span className={numberSize(number)}>{number}</span>
            )}
        </button>
    );
};
