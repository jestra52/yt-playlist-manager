import { createContext, use, useMemo, useReducer, type Dispatch } from 'react';
import type { SpikeVideo } from '../fixture';

interface VideosState {
    ids: string[];
    byId: Record<string, SpikeVideo>;
}

type VideosAction = { type: 'watchedSet'; id: string; watched: boolean };

const reducer = (state: VideosState, action: VideosAction): VideosState => {
    const video = state.byId[action.id];
    if (!video) return state;
    return { ...state, byId: { ...state.byId, [action.id]: { ...video, watched: action.watched } } };
};

const VideosContext = createContext<{ state: VideosState; dispatch: Dispatch<VideosAction> } | null>(null);

export const VideosProvider = ({ videos, children }: { videos: SpikeVideo[]; children: React.ReactNode }) => {
    const [state, dispatch] = useReducer(reducer, videos, (all) => ({
        ids: all.map((v) => v.id),
        byId: Object.fromEntries(all.map((v) => [v.id, v])),
    }));
    const value = useMemo(() => ({ state, dispatch }), [state]);
    return <VideosContext value={value}>{children}</VideosContext>;
};

export const useVideos = () => {
    const value = use(VideosContext);
    if (!value) throw new Error('useVideos needs a VideosProvider');
    return value;
};
