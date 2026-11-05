import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { removeDevice } from '../../chain.thunks';
import styles from './ChainDevices.module.scss';

const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const when = (ms: number) => (ms ? formatter.format(new Date(ms)) : '—');

export const ChainDevices = () => {
    const chain = useAppSelector((state) => state.sync.chain);
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    useEffect(() => {
        if (!confirmingId) return undefined;
        const timer = setTimeout(() => setConfirmingId(null), 4000);
        return () => clearTimeout(timer);
    }, [confirmingId]);

    const remove = (id: string) => {
        if (confirmingId !== id) {
            setConfirmingId(id);
            return;
        }
        setConfirmingId(null);
        dispatch(removeDevice(id));
    };

    return (
        <section aria-labelledby="chain-devices-title">
            <h3 id="chain-devices-title" className={styles.title}>
                Devices in this sync chain
            </h3>
            {!chain ? (
                <p className={styles.loading}>
                    <CircularProgress size={14} color="inherit" /> Loading devices…
                </p>
            ) : (
                <>
                    <ul className={styles.devices}>
                        {chain.devices.map((device) => {
                            const current = device.id === chain.deviceId;
                            const confirming = confirmingId === device.id;
                            return (
                                <li key={device.id} className={styles.device}>
                                    <div className={styles.about}>
                                        <p className={styles.name}>
                                            {device.name}
                                            {current && (
                                                <Chip
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                    label="This device"
                                                    className={styles.chip}
                                                />
                                            )}
                                        </p>
                                        <p className={styles.dates}>
                                            Joined {when(device.createdAt)} · last seen {when(device.lastSeenAt)}
                                        </p>
                                    </div>
                                    {!current && (
                                        <Button
                                            size="small"
                                            color={confirming ? 'error' : 'inherit'}
                                            variant={confirming ? 'contained' : 'text'}
                                            disabled={busy}
                                            aria-label={
                                                confirming ? `Confirm removing ${device.name}` : `Remove ${device.name}`
                                            }
                                            onClick={() => remove(device.id)}
                                        >
                                            {confirming ? 'Remove it' : 'Remove'}
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    <p className={styles.dates}>
                        A removed device stops syncing at once and keeps its playlists. It can join again with the chain
                        code.
                    </p>
                </>
            )}
        </section>
    );
};
