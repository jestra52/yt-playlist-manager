import Link from '@mui/material/Link';
import { NewPlaylistForm } from '../../../playlists/components/sidebar/NewPlaylistForm';
import { PlaylistList } from '../../../playlists/components/sidebar/PlaylistList';
import { SyncStatus } from '../../../sync/components/status/SyncStatus';
import { Brand } from './Brand';
import styles from './Sidebar.module.scss';
import { ThemeSwitch } from '../appearance/ThemeSwitch';

const SOURCE_URL = 'https://github.com/jestra52/yt-playlist-manager';

export const Sidebar = () => (
    <nav className={styles.sidebar} aria-label="Playlists">
        <Brand />
        <PlaylistList />
        <NewPlaylistForm />
        <div className={styles.footer}>
            <SyncStatus />
            <div className={styles.footerRow}>
                <span>Appearance</span>
                <ThemeSwitch />
            </div>
            <Link
                href={SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                underline="none"
                className={styles.sourceLink}
            >
                Source code · AGPL-3.0
            </Link>
        </div>
    </nav>
);
