import Button from '@mui/material/Button';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectFilter, selectQuery } from '../../videos.selectors';
import { filterSet, querySet, type VideoFilter } from '../../videos.slice';
import styles from './NoResults.module.scss';

const MESSAGES: Record<VideoFilter, string> = {
    all: 'Nothing here.',
    unwatched: "You've watched everything here.",
    watched: 'Nothing watched yet.',
    missing: 'Every item has its YouTube link.',
};

export const NoResults = () => {
    const filter = useAppSelector(selectFilter);
    const query = useAppSelector(selectQuery);
    const dispatch = useAppDispatch();
    const searching = Boolean(query.trim());

    return (
        <div className={styles.empty}>
            <p className={styles.message}>{searching ? `Nothing matches "${query.trim()}".` : MESSAGES[filter]}</p>
            <Button
                variant="outlined"
                size="small"
                onClick={() => dispatch(searching ? querySet('') : filterSet('all'))}
            >
                {searching ? 'Clear search' : 'Show all videos'}
            </Button>
        </div>
    );
};
