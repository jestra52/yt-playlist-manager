import { countRender } from '../renderCounts';
import { ContextVideoRow } from './ContextVideoRow';
import { useVideos } from './VideosContext';

export const ContextVideoList = ({ playlistId }: { playlistId: string }) => {
    countRender('list');
    const { state, dispatch } = useVideos();
    return (
        <ul>
            {state.ids
                .map((id) => state.byId[id]!)
                .filter((v) => v.playlistId === playlistId)
                .map((video) => (
                    <ContextVideoRow key={video.id} video={video} dispatch={dispatch} />
                ))}
        </ul>
    );
};
