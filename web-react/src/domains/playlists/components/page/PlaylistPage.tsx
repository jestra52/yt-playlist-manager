import Typography from '@mui/material/Typography';
import { Fragment } from 'react';
import { useAppSelector } from '../../../../app/store';
import { AddVideosForm } from '../../../videos/components/add/AddVideosForm';
import { VideoList } from '../../../videos/components/list/VideoList';
import { PlayerPanel } from '../../../videos/components/player/PlayerPanel';
import { VideoToolbar } from '../../../videos/components/toolbar/VideoToolbar';
import { selectSelectedPlaylist } from '../../playlists.selectors';
import styles from './PlaylistPage.module.scss';
import { PlaylistHeader } from './PlaylistHeader';

export const PlaylistPage = () => {
    const playlist = useAppSelector(selectSelectedPlaylist);

    if (!playlist) {
        return (
            <section className={styles.empty}>
                <Typography variant="h3" component="h1">
                    Start your first playlist
                </Typography>
                <p className={styles.intro}>
                    Choose <strong>New playlist</strong> in the sidebar. This React beta keeps its own library in this
                    browser, separate from the current app.
                </p>
            </section>
        );
    }

    return (
        <section className={styles.page}>
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
