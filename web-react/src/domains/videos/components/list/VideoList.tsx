import { startTransition, useEffect, useState } from 'react';
import { useAppSelector } from '../../../../app/store';
import { selectVisibleVideos } from '../../videos.selectors';
import { KnownArtists } from '../row/KnownArtists';
import { NoResults } from './NoResults';
import styles from './VideoList.module.scss';
import { VideoRow } from './VideoRow';

// Enough to fill a tall screen, so opening a long playlist paints right away.
const FIRST_ROWS = 24;

export const VideoList = ({ playlistId }: { playlistId: string }) => {
    const { rows, total } = useAppSelector((state) => selectVisibleVideos(state, playlistId));
    const [limit, setLimit] = useState(FIRST_ROWS);

    useEffect(() => {
        startTransition(() => setLimit(Infinity));
    }, []);

    if (!total) {
        return (
            <p className={styles.empty}>This playlist is empty. Paste a YouTube link above to add your first video.</p>
        );
    }
    if (!rows.length) return <NoResults />;

    return (
        <>
            <ol className={styles.list}>
                {rows.slice(0, limit).map(({ id, index }) => (
                    <VideoRow key={id} id={id} index={index} total={total} />
                ))}
            </ol>
            <KnownArtists />
        </>
    );
};
