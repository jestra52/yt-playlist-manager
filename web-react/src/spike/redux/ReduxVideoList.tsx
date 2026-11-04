import { countRender } from '../renderCounts';
import { ReduxVideoRow } from './ReduxVideoRow';
import { selectVideoIdsFor, useSpikeSelector } from './videosStore';

export const ReduxVideoList = ({ playlistId }: { playlistId: string }) => {
    countRender('list');
    const ids = useSpikeSelector((state) => selectVideoIdsFor(state, playlistId));
    return (
        <ul>
            {ids.map((id) => (
                <ReduxVideoRow key={id} id={id} />
            ))}
        </ul>
    );
};
