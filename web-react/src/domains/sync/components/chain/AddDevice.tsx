import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { cancelPairing, startPairing } from '../../pairing.thunks';
import { selectPairingPaused } from '../../sync.selectors';
import fields from '../settings/Field.module.scss';
import styles from './AddDevice.module.scss';
import { PairingCode } from './PairingCode';
import { PairingRequest } from './PairingRequest';

export const AddDevice = () => {
    const pairing = useAppSelector((state) => state.sync.pairing);
    const busy = useAppSelector((state) => state.sync.busy);
    const paused = useAppSelector(selectPairingPaused);
    const dispatch = useAppDispatch();
    const name = pairing?.requesterName;

    // Leaving this screen stops showing the code, so it can't be used unattended.
    useEffect(
        () => () => {
            dispatch(cancelPairing());
        },
        [dispatch],
    );

    if (paused) return null;

    const start = (label: string) => (
        <Button
            variant="contained"
            color="inherit"
            size="small"
            className={fields.soft}
            disabled={busy}
            onClick={() => dispatch(startPairing())}
        >
            {label}
        </Button>
    );

    return (
        <section className={styles.section} aria-labelledby="add-device-title">
            <h3 id="add-device-title" className={styles.title}>
                Add a device
            </h3>
            {!pairing && (
                <>
                    <p className={styles.muted}>
                        Show a short code here and enter it on the new device. It works once, for 10 minutes, and you
                        approve the device here before it joins.
                    </p>
                    {start('Show a pairing code')}
                </>
            )}
            {pairing?.status === 'waiting' && <PairingCode code={pairing.code} expiresAt={pairing.expiresAt} />}
            {pairing?.status === 'requested' && (
                <PairingRequest requesterName={pairing.requesterName} expiresAt={pairing.expiresAt} />
            )}
            {pairing?.status === 'approved' && (
                <p className={styles.waiting}>
                    <CircularProgress size={14} color="inherit" /> Allowed. Waiting for {name || 'the new device'} to
                    finish joining…
                </p>
            )}
            {pairing && ['joined', 'denied', 'expired'].includes(pairing.status) && (
                <>
                    <p className={styles.result} role="status">
                        {pairing.status === 'joined' && `${name || 'The new device'} joined the chain.`}
                        {pairing.status === 'denied' && `Refused. ${name || 'That device'} didn't join.`}
                        {pairing.status === 'expired' && 'The pairing code expired.'}
                    </p>
                    <div className={styles.buttons}>
                        {start('Show a new pairing code')}
                        <Button size="small" color="inherit" onClick={() => dispatch(cancelPairing())}>
                            Done
                        </Button>
                    </div>
                </>
            )}
        </section>
    );
};
