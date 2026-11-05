import { useAppSelector } from '../../../../app/store';
import { selectAllVideos, selectPlayingId } from '../../videos.selectors';
import styles from './ProgressStrip.module.scss';

const MAX_SEGMENTS = 80;

export const ProgressStrip = ({ playlistId }: { playlistId: string }) => {
    const videos = useAppSelector(selectAllVideos).filter((video) => video.playlistId === playlistId);
    const playingId = useAppSelector(selectPlayingId);
    const watched = videos.filter((video) => video.watched).length;

    if (!videos.length || videos.length > MAX_SEGMENTS) {
        return (
            <progress
                className="progress progress-success flex-1"
                value={watched}
                max={Math.max(videos.length, 1)}
                aria-label="Watched"
            />
        );
    }

    const look = (id: string, isWatched: boolean) => {
        if (id === playingId) return `${styles.segment} ${styles.playing}`;
        return isWatched ? `${styles.segment} ${styles.watched}` : styles.segment;
    };

    return (
        <div
            className={styles.strip}
            role="progressbar"
            aria-label="Watched"
            aria-valuemin={0}
            aria-valuemax={videos.length}
            aria-valuenow={watched}
        >
            {videos.map((video) => (
                <span key={video.id} className={look(video.id, video.watched)} />
            ))}
        </div>
    );
};
