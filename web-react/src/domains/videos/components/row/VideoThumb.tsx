import { useState } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { played } from '../../videos.slice';
import styles from './VideoThumb.module.scss';

export const VideoThumb = ({ id, src, title }: { id: string; src: string; title: string }) => {
    const [failed, setFailed] = useState(false);
    const dispatch = useAppDispatch();

    return (
        <button
            type="button"
            className={styles.thumb}
            aria-label={`Play ${title}`}
            onClick={() => dispatch(played(id))}
        >
            {failed ? (
                <span className={styles.placeholder}>
                    <Icon name="play" size={28} />
                </span>
            ) : (
                <img src={src} alt="" loading="lazy" width="320" height="180" onError={() => setFailed(true)} />
            )}
            <span className={styles.play}>
                <Icon name="play" size={18} />
            </span>
        </button>
    );
};
