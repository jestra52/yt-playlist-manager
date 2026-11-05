import Button from '@mui/material/Button';
import { countdown } from '@ytpm/core/sync/pairing';
import { useAppDispatch } from '../../../../app/store';
import { useNow } from '../../../../shared/useNow';
import { cancelPairing } from '../../pairing.thunks';
import { useQrCode } from '../code/useQrCode';
import styles from './PairingCode.module.scss';

export const PairingCode = ({ code, expiresAt }: { code: string; expiresAt: number }) => {
    const qr = useQrCode(code);
    const now = useNow(1000);
    const dispatch = useAppDispatch();

    return (
        <div className={styles.card}>
            {qr && <img className={styles.qr} src={qr} alt="The pairing code as a QR code" width={132} height={132} />}
            <div className={styles.about}>
                <p className={styles.code} aria-label="Pairing code">
                    {code}
                </p>
                <p className={styles.muted}>
                    On the new device, open sync settings and choose <strong>Enter a pairing code</strong>, or scan
                    this. Expires in {countdown(expiresAt, now)}.
                </p>
                <Button
                    size="small"
                    color="inherit"
                    className={styles.cancel}
                    onClick={() => dispatch(cancelPairing())}
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
};
