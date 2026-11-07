import { embedUrl } from '@ytpm/core/videos/youtube';
import { useAppSelector } from '../../../../app/store';
import { selectPlaying } from '../../videos.selectors';
import { PlayerControls } from './PlayerControls';
import styles from './PlayerPanel.module.scss';

export const PlayerPanel = () => {
    const video = useAppSelector(selectPlaying);
    if (!video) return null;
    const title = video.title || video.youtubeId;
    const artist = video.artist || video.author;

    return (
        <section className={styles.panel} aria-label="Now playing">
            <div className="card bg-neutral text-neutral-content w-full overflow-hidden shadow-md 2xl:max-w-xl">
                <div className={styles.frame}>
                    <iframe
                        key={video.youtubeId}
                        src={embedUrl(video.youtubeId)}
                        title={video.title || 'YouTube video'}
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        referrerPolicy="strict-origin-when-cross-origin"
                    />
                </div>
                <div className="flex flex-col gap-2 px-4 pt-3 pb-3">
                    <div className="min-w-0">
                        <p className={styles.title}>{title}</p>
                        {artist && <p className="text-neutral-content/70 m-0 truncate text-sm">{artist}</p>}
                    </div>
                    <PlayerControls />
                </div>
            </div>
        </section>
    );
};
