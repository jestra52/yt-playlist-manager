import Checkbox from '@mui/material/Checkbox';
import { watchUrl } from '@ytpm/core/videos/youtube';
import { memo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectVideoById } from '../../videos.selectors';
import { played } from '../../videos.slice';
import { setWatched } from '../../videos.thunks';
import { ArtistLine } from '../row/ArtistLine';
import { CompleteLinkForm } from '../row/CompleteLinkForm';
import { MissingThumb } from '../row/MissingThumb';
import { VideoActions } from '../row/VideoActions';
import { VideoNotes } from '../row/VideoNotes';
import styles from './VideoRow.module.scss';

export const VideoRow = memo(({ id, index, total }: { id: string; index: number; total: number }) => {
    const video = useAppSelector((state) => selectVideoById(state, id));
    const playing = useAppSelector((state) => state.videos.playingId === id);
    const [editingNotes, setEditingNotes] = useState(false);
    const dispatch = useAppDispatch();
    if (!video) return null;
    const title = video.title || (video.missing ? 'Untitled' : video.youtubeId);

    return (
        <li
            className={[styles.row, video.watched && styles.watched, playing && styles.playing]
                .filter(Boolean)
                .join(' ')}
        >
            <Checkbox
                checked={video.watched}
                onChange={(e) => dispatch(setWatched(id, e.target.checked))}
                slotProps={{ input: { 'aria-label': `Watched: ${title}` } }}
            />
            <span className={styles.number}>{index + 1}</span>
            {video.missing ? (
                <MissingThumb unavailable={video.unavailable} />
            ) : (
                <button
                    type="button"
                    className={styles.thumbButton}
                    aria-label={`Play ${title}`}
                    onClick={() => dispatch(played(id))}
                >
                    <img className={styles.thumb} src={video.thumbnailUrl} alt="" loading="lazy" />
                </button>
            )}
            <div className={styles.text}>
                {video.missing ? (
                    <>
                        <p className={styles.plainTitle}>{title}</p>
                        <CompleteLinkForm video={video} title={title} />
                    </>
                ) : (
                    <a
                        className={styles.title}
                        href={watchUrl(video.youtubeId)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {title}
                    </a>
                )}
                <ArtistLine video={video} title={title} />
                <VideoNotes video={video} editing={editingNotes} onEditingChange={setEditingNotes} />
            </div>
            <VideoActions video={video} index={index} total={total} onEditNotes={() => setEditingNotes(true)} />
        </li>
    );
});
