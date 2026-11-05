import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { countdown } from '@ytpm/core/sync/pairing';
import { useAppDispatch } from '../../../../app/store';
import { useNow } from '../../../../shared/useNow';
import { cancelJoinRequest } from '../../pairing.thunks';
import styles from './Notice.module.scss';

export const WaitingForApproval = ({ deviceName, expiresAt }: { deviceName: string; expiresAt: number }) => {
    const now = useNow(1000);
    const dispatch = useAppDispatch();

    return (
        <Alert
            severity="info"
            icon={<CircularProgress size={18} color="inherit" />}
            role="status"
            className={styles.notice}
        >
            <p className={styles.title}>Waiting for approval</p>
            <p className={styles.text}>
                Allow "{deviceName || 'this device'}" on the device that shows the pairing code. Time left:{' '}
                {countdown(expiresAt, now)}.
            </p>
            <Button
                size="small"
                color="inherit"
                className={styles.action}
                onClick={() => dispatch(cancelJoinRequest())}
            >
                Cancel
            </Button>
        </Alert>
    );
};
