import InfoOutlined from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { claimLegacyChain } from '../../chain.thunks';
import styles from './Notice.module.scss';

export const LegacyClaim = ({ deviceName }: { deviceName: string }) => {
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();

    return (
        <Alert severity="info" icon={<InfoOutlined fontSize="small" />} className={styles.notice}>
            <p className={styles.title}>Your synced playlists can become a sync chain</p>
            <p className={styles.text}>
                This device synced with the old shared sync token. Turn that library into a sync chain to keep syncing
                it; you'll get its code to add your other devices.
            </p>
            <Button
                variant="contained"
                size="small"
                className={styles.action}
                disabled={busy}
                onClick={() => dispatch(claimLegacyChain(deviceName))}
            >
                Turn it into a sync chain
            </Button>
        </Alert>
    );
};
