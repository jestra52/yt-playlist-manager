import { useMemo } from 'react';
import { PLAYLISTS } from '../fixture';
import { countRender } from '../renderCounts';
import { useVideos } from './VideosContext';

export const ContextSidebar = () => {
    countRender('sidebar');
    const { state } = useVideos();
    const counts = useMemo(() => {
        const all = state.ids.map((id) => state.byId[id]!);
        return PLAYLISTS.map((p) => {
            const mine = all.filter((v) => v.playlistId === p.id);
            return { id: p.id, name: p.name, left: mine.filter((v) => !v.watched).length, total: mine.length };
        });
    }, [state]);
    return (
        <ul>
            {counts.map((p) => (
                <li key={p.id}>
                    {p.name} {p.left}/{p.total}
                </li>
            ))}
        </ul>
    );
};
