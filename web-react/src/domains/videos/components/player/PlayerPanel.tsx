import CloseIcon from '@mui/icons-material/Close';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { embedUrl } from '@ytpm/core/videos/youtube';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { selectPlaying } from '../../videos.selectors';
import { playerClosed } from '../../videos.slice';
import { finishAndPlayNext } from '../../videos.thunks';
import styles from './PlayerPanel.module.scss';

export const PlayerPanel = () => {
    const video = useAppSelector(selectPlaying);
    const dispatch = useAppDispatch();
    if (!video) return null;
    const title = video.title || video.youtubeId;

    return (
        <section className={styles.player} aria-label="Now playing">
            <div className={styles.frame}>
                <iframe
                    key={video.youtubeId}
                    src={embedUrl(video.youtubeId)}
                    title={video.title || 'YouTube video'}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    referrerPolicy="strict-origin-when-cross-origin"
                />
            </div>
            <div className={styles.bar}>
                <p className={styles.title}>{title}</p>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<SkipNextIcon />}
                    onClick={() => dispatch(finishAndPlayNext())}
                >
                    Watched, play next
                </Button>
                <IconButton
                    size="small"
                    color="inherit"
                    aria-label="Close player"
                    onClick={() => dispatch(playerClosed())}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </div>
        </section>
    );
};
