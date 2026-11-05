import { Fragment } from 'react';
import { useAppSelector } from '../../../../app/store';
import { AddVideosForm } from '../../../videos/components/add/AddVideosForm';
import { VideoList } from '../../../videos/components/list/VideoList';
import { PlayerPanel } from '../../../videos/components/player/PlayerPanel';
import { VideoToolbar } from '../../../videos/components/toolbar/VideoToolbar';
import { selectSelectedPlaylist } from '../../playlists.selectors';
import { FirstPlaylist } from './FirstPlaylist';
import { PlaylistHeader } from './PlaylistHeader';

export const PlaylistPage = () => {
    const playlist = useAppSelector(selectSelectedPlaylist);

    if (!playlist) return <FirstPlaylist />;

    return (
        <section>
            <PlayerPanel />
            <Fragment key={playlist.id}>
                <PlaylistHeader playlist={playlist} />
                <AddVideosForm playlistId={playlist.id} />
                <VideoToolbar playlistId={playlist.id} />
                <VideoList playlistId={playlist.id} />
            </Fragment>
        </section>
    );
};
