import Link from '@mui/material/Link';
import { Brand } from './Brand';
import styles from './Sidebar.module.scss';
import { ThemeSwitch } from '../appearance/ThemeSwitch';

const SOURCE_URL = 'https://github.com/jestra52/yt-playlist-manager';

export const Sidebar = () => (
    <nav className={styles.sidebar} aria-label="Playlists">
        <Brand />
        <p className={styles.hint}>Playlists come in the next step.</p>
        <div className={styles.footer}>
            <div className={styles.footerRow}>
                <span>Appearance</span>
                <ThemeSwitch />
            </div>
            <Link href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                Source code · AGPL-3.0
            </Link>
        </div>
    </nav>
);
