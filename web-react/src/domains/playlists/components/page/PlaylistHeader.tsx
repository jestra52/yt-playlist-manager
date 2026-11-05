import LinearProgress from '@mui/material/LinearProgress';
import type { Playlist } from '@ytpm/core/playlists/playlists.repository';
import { useAppSelector } from '../../../../app/store';
import { selectProgressByPlaylist } from '../../../videos/videos.selectors';
import { ReportButtons } from '../reports/ReportButtons';
import { YouTubeButton } from '../youtube/YouTubeButton';
import { DeletePlaylistButton } from './DeletePlaylistButton';
import { PlaylistDescriptionField } from './PlaylistDescriptionField';
import styles from './PlaylistHeader.module.scss';
import { PlaylistNameField } from './PlaylistNameField';

const tally = (left: number, total: number) => {
    if (!total) return 'No videos yet';
    if (!left) return `All ${total} watched`;
    return `${left} left of ${total}`;
};

export const PlaylistHeader = ({ playlist }: { playlist: Playlist }) => {
    const { left, total } = useAppSelector(selectProgressByPlaylist)[playlist.id] ?? { left: 0, total: 0 };
    const watched = total ? ((total - left) / total) * 100 : 0;

    return (
        <header>
            <div className={styles.top}>
                <PlaylistNameField key={playlist.name} playlist={playlist} />
                <YouTubeButton playlist={playlist} />
                <ReportButtons playlistId={playlist.id} />
                <DeletePlaylistButton playlistId={playlist.id} />
            </div>
            <PlaylistDescriptionField key={playlist.description} playlist={playlist} />
            <div className={styles.progress}>
                <LinearProgress
                    variant="determinate"
                    value={watched}
                    color="success"
                    className={styles.bar}
                    aria-label="Watched"
                />
                <span>{tally(left, total)}</span>
            </div>
        </header>
    );
};
