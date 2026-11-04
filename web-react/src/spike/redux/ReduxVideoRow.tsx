import { memo } from 'react';
import { countRender } from '../renderCounts';
import { selectVideoById, useSpikeDispatch, useSpikeSelector, watchedSet } from './videosStore';

export const ReduxVideoRow = memo(({ id }: { id: string }) => {
    countRender('row');
    const video = useSpikeSelector((state) => selectVideoById(state, id));
    const dispatch = useSpikeDispatch();
    if (!video) return null;
    return (
        <li>
            <label>
                <input
                    type="checkbox"
                    checked={video.watched}
                    onChange={(e) => dispatch(watchedSet({ id, watched: e.target.checked }))}
                    aria-label={`Watched ${video.title}`}
                />
                {video.title} · {video.artist}
            </label>
        </li>
    );
});
