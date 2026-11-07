import { useAppSelector } from '../../../../app/store';
import { AddVideosForm } from '../../../videos/components/add/AddVideosForm';
import { VideoList } from '../../../videos/components/list/VideoList';
import { PlayerPanel } from '../../../videos/components/player/PlayerPanel';
import { selectPlayingId } from '../../../videos/videos.selectors';
import { VideoToolbar } from '../../../videos/components/toolbar/VideoToolbar';
import { selectSelectedPlaylist } from '../../playlists.selectors';
import { FirstPlaylist } from './FirstPlaylist';
import { PlaylistHeader } from './PlaylistHeader';
import styles from './PlaylistPage.module.scss';

export const PlaylistPage = () => {
    const playlist = useAppSelector(selectSelectedPlaylist);
    const playing = useAppSelector(selectPlayingId) !== null;

    if (!playlist) return <FirstPlaylist />;

    return (
        <section className={playing ? `${styles.page} ${styles.playing}` : styles.page}>
            <PlayerPanel />
            <div key={playlist.id} className={styles.content}>
                <PlaylistHeader playlist={playlist} />
                <AddVideosForm playlistId={playlist.id} />
                <VideoToolbar playlistId={playlist.id} />
                <VideoList playlistId={playlist.id} />
            </div>
        </section>
    );
};
