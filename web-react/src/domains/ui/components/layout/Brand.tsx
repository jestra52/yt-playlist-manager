import styles from './Brand.module.scss';

export const Brand = () => (
    <div className={styles.brand}>
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="5" y="8" width="14" height="3.4" rx="1.7" fill="currentColor" />
            <rect x="5" y="14.3" width="14" height="3.4" rx="1.7" fill="currentColor" />
            <rect x="5" y="20.6" width="9" height="3.4" rx="1.7" fill="currentColor" />
            <path d="M20.5 17.5v8.5l7-4.25z" fill="#ff5a4f" />
        </svg>
        <div>
            <p className={styles.name}>Yuzu Tapes</p>
            <p className={styles.sub}>Playlist Manager</p>
        </div>
    </div>
);
