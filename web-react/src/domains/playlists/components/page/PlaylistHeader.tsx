import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { useAppSelector } from '../../../../app/store';
import { selectProgressByPlaylist } from '../../../videos/videos.selectors';
import styles from './PlaylistHeader.module.scss';

export const PlaylistHeader = ({ playlist }: { playlist: Playlist }) => {
    const { left, total } = useAppSelector(selectProgressByPlaylist)[playlist.id] ?? { left: 0, total: 0 };
    const watched = total ? ((total - left) / total) * 100 : 0;

    return (
        <header>
            <Typography variant="h3" component="h1">
                {playlist.name}
            </Typography>
            {playlist.description && <p className={styles.description}>{playlist.description}</p>}
            <div className={styles.progress}>
                <LinearProgress
                    variant="determinate"
                    value={watched}
                    color="success"
                    className={styles.bar}
                    aria-label="Watched"
                />
                <span>
                    <strong>{left}</strong> left of {total}
                </span>
            </div>
        </header>
    );
};
