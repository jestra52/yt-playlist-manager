import { useAppSelector } from '../../../../app/store';
import { selectVideoIdsFor } from '../../videos.selectors';
import styles from './VideoList.module.scss';
import { VideoRow } from './VideoRow';

export const VideoList = ({ playlistId }: { playlistId: string }) => {
    const ids = useAppSelector((state) => selectVideoIdsFor(state, playlistId));

    if (!ids.length) {
        return (
            <p className={styles.empty}>This playlist is empty. Paste a YouTube link above to add your first video.</p>
        );
    }

    return (
        <ol className={styles.list}>
            {ids.map((id, i) => (
                <VideoRow key={id} id={id} number={i + 1} />
            ))}
        </ol>
    );
};
