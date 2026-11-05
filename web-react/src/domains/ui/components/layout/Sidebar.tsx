import { NewPlaylistForm } from '../../../playlists/components/sidebar/NewPlaylistForm';
import { PlaylistList } from '../../../playlists/components/sidebar/PlaylistList';
import { SyncStatus } from '../../../sync/components/status/SyncStatus';
import { ThemeSwitch } from '../appearance/ThemeSwitch';
import { Brand } from './Brand';
import styles from './Sidebar.module.scss';

const SOURCE_URL = 'https://github.com/jestra52/yt-playlist-manager';

export const Sidebar = () => (
    <nav
        className={`bg-neutral text-neutral-content flex min-h-full w-72 flex-col px-3 pt-5 pb-4 ${styles.sidebar}`}
        aria-label="Playlists"
    >
        <Brand />
        <PlaylistList />
        <NewPlaylistForm />
        <div className="mt-auto flex flex-col gap-3 px-3 pt-4 text-[0.8125rem]">
            <SyncStatus />
            <div className="flex items-center justify-between">
                <span className="text-xs opacity-70">Appearance</span>
                <ThemeSwitch />
            </div>
            <a className={`text-xs ${styles.sourceLink}`} href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
                Source code · AGPL-3.0
            </a>
        </div>
    </nav>
);
