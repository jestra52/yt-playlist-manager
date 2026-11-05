import { watchUrl } from '@ytpm/core/videos/youtube';
import { memo, useState } from 'react';
import { useAppSelector } from '../../../../app/store';
import { selectVideoById } from '../../videos.selectors';
import { ArtistLine } from '../row/ArtistLine';
import { CompleteLinkForm } from '../row/CompleteLinkForm';
import { MissingThumb } from '../row/MissingThumb';
import { VideoActions } from '../row/VideoActions';
import { VideoNotes } from '../row/VideoNotes';
import { VideoThumb } from '../row/VideoThumb';
import { WatchedMark } from '../row/WatchedMark';
import styles from './VideoRow.module.scss';

export const VideoRow = memo(({ id, index, total }: { id: string; index: number; total: number }) => {
    const video = useAppSelector((state) => selectVideoById(state, id));
    const playing = useAppSelector((state) => state.videos.playingId === id);
    const [editingNotes, setEditingNotes] = useState(false);
    if (!video) return null;
    const title = video.title || (video.missing ? 'Untitled' : video.youtubeId);

    return (
        <li
            className={`list-row items-start ${styles.row} ${video.watched ? styles.watched : ''}`}
            data-playing={playing || undefined}
        >
            <WatchedMark id={id} number={index + 1} title={title} watched={video.watched} />
            {video.missing ? (
                <MissingThumb unavailable={video.unavailable} />
            ) : (
                <VideoThumb id={id} src={video.thumbnailUrl} title={title} />
            )}
            <div className="list-col-grow min-w-0">
                {video.missing ? (
                    <>
                        <p className={styles.title}>{title}</p>
                        <CompleteLinkForm video={video} title={title} />
                    </>
                ) : (
                    <a
                        className={`link link-hover ${styles.title}`}
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
