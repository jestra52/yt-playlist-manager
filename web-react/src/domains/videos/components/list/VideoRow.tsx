import Checkbox from '@mui/material/Checkbox';
import { watchUrl } from '@ytpm/core/videos/youtube';
import { memo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectVideoById } from '../../videos.selectors';
import { setWatched } from '../../videos.thunks';
import { ArtistLine } from '../row/ArtistLine';
import { VideoActions } from '../row/VideoActions';
import { VideoNotes } from '../row/VideoNotes';
import styles from './VideoRow.module.scss';

export const VideoRow = memo(({ id, index, total }: { id: string; index: number; total: number }) => {
    const video = useAppSelector((state) => selectVideoById(state, id));
    const [editingNotes, setEditingNotes] = useState(false);
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
            <span className={styles.number}>{index + 1}</span>
            {video.thumbnailUrl && <img className={styles.thumb} src={video.thumbnailUrl} alt="" loading="lazy" />}
            <div className={styles.text}>
                <a className={styles.title} href={watchUrl(video.youtubeId)} target="_blank" rel="noopener noreferrer">
                    {title}
                </a>
                <ArtistLine video={video} title={title} />
                <VideoNotes video={video} editing={editingNotes} onEditingChange={setEditingNotes} />
            </div>
            <VideoActions video={video} index={index} total={total} onEditNotes={() => setEditingNotes(true)} />
        </li>
    );
});
