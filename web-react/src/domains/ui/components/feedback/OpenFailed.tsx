import styles from './OpenFailed.module.scss';

export const OpenFailed = ({ reason }: { reason: string }) => (
    <main className={styles.screen}>
        <div role="alert" className={styles.alert}>
            <h1 className={styles.title}>The local database didn't open</h1>
            <p>{reason}</p>
            <p>Private browsing or blocked site storage can cause this. Allow storage for this site and reload.</p>
        </div>
    </main>
);
