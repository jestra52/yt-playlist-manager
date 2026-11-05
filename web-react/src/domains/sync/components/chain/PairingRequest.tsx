import InfoOutlined from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { countdown } from '@ytpm/core/sync/pairing';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { useNow } from '../../../../shared/useNow';
import { approvePairing, denyPairing } from '../../pairing.thunks';
import fields from '../settings/Field.module.scss';
import styles from '../start/Notice.module.scss';

export const PairingRequest = ({ requesterName, expiresAt }: { requesterName: string; expiresAt: number }) => {
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();
    const now = useNow(1000);

    return (
        <Alert
            severity="info"
            icon={<InfoOutlined fontSize="small" />}
            role="alertdialog"
            aria-labelledby="pairing-ask"
            className={styles.notice}
        >
            <p id="pairing-ask" className={styles.title}>
                Allow {requesterName || 'this device'} to join?
            </p>
            <p className={styles.text}>
                It will sync every playlist in this chain. Only allow it if it's your device and you just entered the
                code on it. Answer within {countdown(expiresAt, now)}.
            </p>
            <div className={styles.actions}>
                <Button variant="contained" size="small" disabled={busy} onClick={() => dispatch(approvePairing())}>
                    Allow
                </Button>
                <Button
                    variant="contained"
                    color="inherit"
                    size="small"
                    className={fields.soft}
                    disabled={busy}
                    onClick={() => dispatch(denyPairing())}
                >
                    Deny
                </Button>
            </div>
        </Alert>
    );
};
