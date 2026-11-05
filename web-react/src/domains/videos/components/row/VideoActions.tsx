import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import StickyNote2Outlined from '@mui/icons-material/StickyNote2Outlined';
import IconButton from '@mui/material/IconButton';
import type { Video } from '@ytpm/core/videos/videos.repository';
import { useAppDispatch } from '../../../../app/store';
import { removeVideo, reorder } from '../../videos.thunks';
import { MoveMenu } from './MoveMenu';
import styles from './VideoActions.module.scss';

interface VideoActionsProps {
    video: Video;
    index: number;
    total: number;
    onEditNotes: () => void;
}

export const VideoActions = ({ video, index, total, onEditNotes }: VideoActionsProps) => {
    const dispatch = useAppDispatch();

    return (
        <div className={styles.actions}>
            <IconButton
                size="small"
                title="Move up"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => dispatch(reorder(video.id, index - 1))}
            >
                <ArrowUpward fontSize="small" />
            </IconButton>
            <IconButton
                size="small"
                title="Move down"
                aria-label="Move down"
                disabled={index === total - 1}
                onClick={() => dispatch(reorder(video.id, index + 1))}
            >
                <ArrowDownward fontSize="small" />
            </IconButton>
            <IconButton size="small" title="Notes" aria-label="Edit notes" onClick={onEditNotes}>
                <StickyNote2Outlined fontSize="small" />
            </IconButton>
            <MoveMenu video={video} />
            <IconButton
                size="small"
                title="Remove"
                aria-label="Remove from playlist"
                onClick={() => dispatch(removeVideo(video.id))}
            >
                <DeleteOutlined fontSize="small" />
            </IconButton>
        </div>
    );
};
