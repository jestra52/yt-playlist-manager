import { watchUrl } from '@ytpm/core/videos/youtube';
import { memo, useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../../../app/store';
import { selectVideoById } from '../../videos.selectors';
import { ArtistLine } from '../row/ArtistLine';
import { MissingThumb } from '../row/MissingThumb';
import { PositionForm } from '../row/PositionForm';
import { RowNumber } from '../row/RowNumber';
import { VideoActions } from '../row/VideoActions';
import { VideoLinkForm } from '../row/VideoLinkForm';
import { VideoNotes } from '../row/VideoNotes';
import { VideoThumb } from '../row/VideoThumb';
import styles from './VideoRow.module.scss';

const MOVED_HIGHLIGHT_MS = 1600;

export const VideoRow = memo(({ id, index, total }: { id: string; index: number; total: number }) => {
    const video = useAppSelector((state) => selectVideoById(state, id));
    const playing = useAppSelector((state) => state.videos.playingId === id);
    const [editingNotes, setEditingNotes] = useState(false);
    const [editingLink, setEditingLink] = useState(false);
    const [movingTo, setMovingTo] = useState(false);
    const [moved, setMoved] = useState(false);
    const rowRef = useRef<HTMLLIElement>(null);
    const numberRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!moved) return;
        rowRef.current?.scrollIntoView({ block: 'end' });
        const timer = setTimeout(() => setMoved(false), MOVED_HIGHLIGHT_MS);
        return () => clearTimeout(timer);
    }, [moved]);

    if (!video) return null;
    const title = video.title || (video.missing ? 'Untitled' : video.youtubeId);
    const closePositionForm = () => {
        setMovingTo(false);
        numberRef.current?.focus();
    };

    return (
        <li
            ref={rowRef}
            className={`list-row items-start ${styles.row}`}
            data-playing={playing || undefined}
            data-moved={moved || undefined}
        >
            <RowNumber
                ref={numberRef}
                number={index + 1}
                title={title}
                open={movingTo}
                onClick={() => setMovingTo(!movingTo)}
            />
            {video.missing ? (
                <MissingThumb unavailable={video.unavailable} />
            ) : (
                <VideoThumb id={id} src={video.thumbnailUrl} title={title} />
            )}
            <div className="list-col-grow min-w-0">
                {video.missing ? (
                    <>
                        <p className={styles.title}>{title}</p>
                        <VideoLinkForm video={video} title={title} />
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
            <VideoActions
                video={video}
                index={index}
                total={total}
                onEditNotes={() => setEditingNotes(true)}
                onEditLink={() => setEditingLink(true)}
            />
            {(movingTo || (editingLink && !video.missing)) && (
                <div className="col-span-full row-start-3">
                    {movingTo && (
                        <PositionForm
                            video={video}
                            title={title}
                            index={index}
                            total={total}
                            onMoved={() => {
                                closePositionForm();
                                setMoved(true);
                            }}
                            onClose={closePositionForm}
                        />
                    )}
                    {editingLink && !video.missing && (
                        <VideoLinkForm video={video} title={title} onClose={() => setEditingLink(false)} />
                    )}
                </div>
            )}
        </li>
    );
});
