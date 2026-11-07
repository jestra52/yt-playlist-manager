import { embedUrl } from '@ytpm/core/videos/youtube';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { selectPlaying } from '../../videos.selectors';
import { playerClosed } from '../../videos.slice';
import { playNext } from '../../videos.thunks';
import styles from './PlayerPanel.module.scss';

export const PlayerPanel = () => {
    const video = useAppSelector(selectPlaying);
    const dispatch = useAppDispatch();
    if (!video) return null;
    const title = video.title || video.youtubeId;

    return (
        <section
            className="card bg-neutral text-neutral-content mb-6 overflow-hidden shadow-md"
            aria-label="Now playing"
        >
            <div className={styles.frame}>
                <iframe
                    key={video.youtubeId}
                    src={embedUrl(video.youtubeId)}
                    title={video.title || 'YouTube video'}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    referrerPolicy="strict-origin-when-cross-origin"
                />
            </div>
            <div className="flex items-center gap-3 py-2.5 pr-2.5 pl-4">
                <p className="m-0 min-w-0 flex-1 truncate font-semibold">{title}</p>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => dispatch(playNext())}>
                    <Icon name="next" size={15} /> Next
                </button>
                <button
                    className="btn btn-ghost btn-sm btn-square text-neutral-content"
                    type="button"
                    aria-label="Close player"
                    onClick={() => dispatch(playerClosed())}
                >
                    <Icon name="close" />
                </button>
            </div>
        </section>
    );
};
