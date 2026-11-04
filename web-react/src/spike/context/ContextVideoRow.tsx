import { memo, type Dispatch } from 'react';
import type { SpikeVideo } from '../fixture';
import { countRender } from '../renderCounts';

type Action = { type: 'watchedSet'; id: string; watched: boolean };

export const ContextVideoRow = memo(({ video, dispatch }: { video: SpikeVideo; dispatch: Dispatch<Action> }) => {
    countRender('row');
    return (
        <li>
            <label>
                <input
                    type="checkbox"
                    checked={video.watched}
                    onChange={(e) => dispatch({ type: 'watchedSet', id: video.id, watched: e.target.checked })}
                    aria-label={`Watched ${video.title}`}
                />
                {video.title} · {video.artist}
            </label>
        </li>
    );
});
