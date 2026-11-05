import { startTransition, useEffect, useState } from 'react';
import { useAppSelector } from '../../../../app/store';
import { selectVisibleVideos } from '../../videos.selectors';
import { KnownArtists } from '../row/KnownArtists';
import { NoResults } from './NoResults';
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
            <div className="rounded-box border-base-300 border border-dashed px-6 py-10">
                <p className="font-display m-0 text-2xl font-bold tracking-tight">This playlist is empty.</p>
                <p className="text-base-content/65 mt-1 mb-0">
                    Paste a YouTube link above to add your first video. You can paste several at once.
                </p>
            </div>
        );
    }
    if (!rows.length) return <NoResults />;

    return (
        <>
            <ol className="list rounded-box bg-base-100 m-0 p-0 shadow-sm">
                {rows.slice(0, limit).map(({ id, index }) => (
                    <VideoRow key={id} id={id} index={index} total={total} />
                ))}
            </ol>
            <KnownArtists />
        </>
    );
};
