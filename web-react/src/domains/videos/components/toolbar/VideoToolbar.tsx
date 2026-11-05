import SearchIcon from '@mui/icons-material/Search';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectFilter, selectMissingCount, selectQuery } from '../../videos.selectors';
import { filterSet, querySet, type VideoFilter } from '../../videos.slice';
import styles from './VideoToolbar.module.scss';

export const VideoToolbar = ({ playlistId }: { playlistId: string }) => {
    const filter = useAppSelector(selectFilter);
    const query = useAppSelector(selectQuery);
    const missing = useAppSelector((state) => selectMissingCount(state, playlistId));
    const dispatch = useAppDispatch();

    return (
        <div className={styles.toolbar}>
            <Tabs
                value={filter}
                onChange={(_, value: VideoFilter) => dispatch(filterSet(value))}
                aria-label="Show"
                className={styles.tabs}
            >
                <Tab value="all" label="All" />
                <Tab value="unwatched" label="To watch" />
                <Tab value="watched" label="Watched" />
                {(missing > 0 || filter === 'missing') && <Tab value="missing" label={`Missing (${missing})`} />}
            </Tabs>
            <label className={styles.search}>
                <SearchIcon fontSize="small" />
                <span className={styles.label}>Search this playlist</span>
                <input
                    type="search"
                    className={styles.input}
                    value={query}
                    onChange={(e) => dispatch(querySet(e.target.value))}
                    placeholder="Search titles, artists, channels, notes"
                />
            </label>
        </div>
    );
};
