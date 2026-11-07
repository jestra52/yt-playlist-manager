import { embedUrl } from '@ytpm/core/videos/youtube';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { selectNextVideo, selectPlaying, selectPreviousVideo, selectShuffleOn } from '../../videos.selectors';
import { playerClosed } from '../../videos.slice';
import { playNext, playPrevious, toggleShuffle } from '../../videos.thunks';
import styles from './PlayerPanel.module.scss';

export const PlayerPanel = () => {
    const video = useAppSelector(selectPlaying);
    const hasNext = useAppSelector(selectNextVideo) !== null;
    const hasPrevious = useAppSelector(selectPreviousVideo) !== null;
    const shuffleOn = useAppSelector(selectShuffleOn);
    const dispatch = useAppDispatch();
    if (!video) return null;
    const title = video.title || video.youtubeId;

    return (
        <section className={styles.panel} aria-label="Now playing">
            <div className="card bg-neutral text-neutral-content overflow-hidden shadow-md">
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
                    <button
                        className={`btn btn-sm max-md:btn-square ${shuffleOn ? 'btn-secondary' : 'btn-ghost text-neutral-content'}`}
                        type="button"
                        aria-label="Shuffle"
                        aria-pressed={shuffleOn}
                        onClick={() => dispatch(toggleShuffle())}
                    >
                        <Icon name="shuffle" size={15} /> <span className="max-md:hidden">Shuffle</span>
                    </button>
                    <button
                        className="btn btn-ghost btn-sm text-neutral-content max-md:btn-square"
                        type="button"
                        aria-label="Previous"
                        disabled={!hasPrevious}
                        onClick={() => dispatch(playPrevious())}
                    >
                        <Icon name="previous" size={15} /> <span className="max-md:hidden">Previous</span>
                    </button>
                    <button
                        className="btn btn-primary btn-sm max-md:btn-square"
                        type="button"
                        aria-label="Next"
                        disabled={!hasNext}
                        onClick={() => dispatch(playNext())}
                    >
                        <Icon name="next" size={15} /> <span className="max-md:hidden">Next</span>
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
            </div>
        </section>
    );
};
