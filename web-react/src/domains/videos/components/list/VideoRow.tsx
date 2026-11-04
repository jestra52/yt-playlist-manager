import Checkbox from '@mui/material/Checkbox';
import { watchUrl } from '@ytpm/core/videos/youtube';
import { memo } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectVideoById } from '../../videos.selectors';
import { setWatched } from '../../videos.thunks';
import styles from './VideoRow.module.scss';

export const VideoRow = memo(({ id, number }: { id: string; number: number }) => {
    const video = useAppSelector((state) => selectVideoById(state, id));
    const dispatch = useAppDispatch();
    if (!video) return null;
    const title = video.title || video.youtubeId;

    return (
        <li className={video.watched ? `${styles.row} ${styles.watched}` : styles.row}>
            <Checkbox
                checked={video.watched}
                onChange={(e) => dispatch(setWatched(id, e.target.checked))}
                slotProps={{ input: { 'aria-label': `Watched: ${title}` } }}
            />
            <span className={styles.number}>{number}</span>
            {video.thumbnailUrl && <img className={styles.thumb} src={video.thumbnailUrl} alt="" loading="lazy" />}
            <div className={styles.text}>
                <a className={styles.title} href={watchUrl(video.youtubeId)} target="_blank" rel="noopener noreferrer">
                    {title}
                </a>
                {(video.artist || video.author) && (
                    <span className={styles.meta}>
                        {[video.artist, video.author && `uploaded by ${video.author}`].filter(Boolean).join(' · ')}
                    </span>
                )}
            </div>
        </li>
    );
});
