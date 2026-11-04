export interface SpikeVideo {
    id: string;
    playlistId: string;
    title: string;
    artist: string;
    watched: boolean;
}

export interface SpikePlaylist {
    id: string;
    name: string;
}

export const PLAYLISTS: SpikePlaylist[] = [
    { id: 'p1', name: 'City Pop' },
    { id: 'p2', name: 'Late-night drives' },
    { id: 'p3', name: 'Lectures' },
];

export const makeVideos = (count: number): SpikeVideo[] =>
    Array.from({ length: count }, (_, i) => ({
        id: `v${i}`,
        playlistId: i % 10 === 0 ? 'p2' : 'p1',
        title: `Video ${i}`,
        artist: `Artist ${i % 37}`,
        watched: i % 3 === 0,
    }));
