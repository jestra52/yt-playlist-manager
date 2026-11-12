import type { Video } from '@ytpm/core/videos/videos.repository';
import { useAppDispatch } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { removeVideo, reorder } from '../../videos.thunks';
import { MoveMenu } from './MoveMenu';
import styles from './VideoActions.module.scss';

interface VideoActionsProps {
    video: Video;
    index: number;
    total: number;
    canMove: boolean;
    onEditNotes: () => void;
    onEditLink: () => void;
}

const BUTTON = 'btn btn-ghost btn-square btn-sm';

export const VideoActions = ({ video, index, total, canMove, onEditNotes, onEditLink }: VideoActionsProps) => {
    const dispatch = useAppDispatch();

    return (
        <div className={`max-md:list-col-wrap flex ${styles.actions}`}>
            <button
                type="button"
                className={BUTTON}
                title="Move up"
                aria-label="Move up"
                disabled={!canMove || index === 0}
                onClick={() => dispatch(reorder(video.id, index - 1))}
            >
                <Icon name="up" size={17} />
            </button>
            <button
                type="button"
                className={BUTTON}
                title="Move down"
                aria-label="Move down"
                disabled={!canMove || index === total - 1}
                onClick={() => dispatch(reorder(video.id, index + 1))}
            >
                <Icon name="down" size={17} />
            </button>
            <button type="button" className={BUTTON} title="Notes" aria-label="Edit notes" onClick={onEditNotes}>
                <Icon name="note" size={17} />
            </button>
            {!video.missing && (
                <button
                    type="button"
                    className={BUTTON}
                    title="Change link"
                    aria-label="Change link"
                    onClick={onEditLink}
                >
                    <Icon name="link" size={17} />
                </button>
            )}
            <MoveMenu video={video} />
            <button
                type="button"
                className={BUTTON}
                title="Remove"
                aria-label="Remove from playlist"
                onClick={() => dispatch(removeVideo(video.id))}
            >
                <Icon name="trash" size={17} />
            </button>
        </div>
    );
};
