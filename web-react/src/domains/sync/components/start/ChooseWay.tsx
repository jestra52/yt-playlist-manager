import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import { canScan } from '@ytpm/core/sync/qr-scan';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { createChain } from '../../chain.thunks';
import fields from '../settings/Field.module.scss';
import styles from './ChooseWay.module.scss';
import type { StartMode } from './StartScreen';

interface ChooseWayProps {
    deviceName: string;
    onMode: (mode: StartMode) => void;
    onScan: () => void;
}

export const ChooseWay = ({ deviceName, onMode, onScan }: ChooseWayProps) => {
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();

    return (
        <>
            <div className={styles.ways}>
                <Button
                    variant="contained"
                    disabled={busy}
                    startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
                    onClick={() => dispatch(createChain(deviceName))}
                >
                    Create a sync chain
                </Button>
                <Button
                    variant="contained"
                    color="inherit"
                    className={fields.soft}
                    disabled={busy}
                    onClick={() => onMode('pair')}
                >
                    Enter a pairing code
                </Button>
                <Button
                    variant="contained"
                    color="inherit"
                    className={fields.soft}
                    disabled={busy}
                    onClick={() => onMode('join')}
                >
                    Enter the chain code
                </Button>
            </div>
            {canScan() && (
                <p className={styles.note}>
                    <Link component="button" type="button" color="inherit" disabled={busy} onClick={onScan}>
                        Scan a QR code instead
                    </Link>
                </p>
            )}
            <p className={`${styles.note} ${styles.muted}`}>
                Lost every device and the code?{' '}
                <Link
                    component="button"
                    type="button"
                    color="inherit"
                    disabled={busy}
                    onClick={() => onMode('recover')}
                >
                    Recover with a recovery code
                </Link>
            </p>
        </>
    );
};
