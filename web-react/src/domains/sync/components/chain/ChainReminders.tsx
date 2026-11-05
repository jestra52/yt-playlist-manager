import InfoOutlined from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { renewRecoveryCodes } from '../../chain.thunks';
import { selectCheckInDue, selectPairingPaused, selectRecoveryNotice } from '../../sync.selectors';
import { checkedCodes } from '../../sync.thunks';
import styles from '../start/Notice.module.scss';
import fields from '../settings/Field.module.scss';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const icon = <InfoOutlined fontSize="small" />;

export const ChainReminders = ({ onReplaceCode }: { onReplaceCode: () => void }) => {
    const paused = useAppSelector(selectPairingPaused);
    const recoveryNotice = useAppSelector(selectRecoveryNotice);
    const checkInDue = useAppSelector(selectCheckInDue);
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();
    const [lostCodes, setLostCodes] = useState(false);
    const soft = { variant: 'contained', color: 'inherit', size: 'small', className: fields.soft } as const;

    return (
        <>
            {paused && (
                <Alert severity="warning" icon={icon} role="alert" className={styles.notice}>
                    <p className={styles.title}>Adding devices with a pairing code is paused</p>
                    <p className={styles.text}>
                        Someone was refused several times while trying to join this chain, so pairing codes don't work
                        until {timeFormat.format(new Date(paused))}. If you don't know who it was, generate a new code
                        in Security; you can still add a device with the chain code.
                    </p>
                </Alert>
            )}
            {recoveryNotice && (
                <Alert severity="warning" icon={icon} role="status" className={styles.notice}>
                    <p className={styles.title}>Add another device or recovery codes so you don't lose access</p>
                    <p className={styles.text}>
                        This is the only device in the chain, and the chain has no recovery codes. If you lose this
                        device and the code, nobody can get the chain back.
                    </p>
                    <div className={styles.actions}>
                        <Button {...soft} disabled={busy} onClick={() => dispatch(renewRecoveryCodes())}>
                            Create recovery codes
                        </Button>
                    </div>
                </Alert>
            )}
            {!recoveryNotice && checkInDue && (
                <Alert severity="info" icon={icon} role="status" className={styles.notice}>
                    <p className={styles.title}>Do you still have your sync chain code and recovery codes?</p>
                    {lostCodes ? (
                        <>
                            <p className={styles.text}>
                                Make new ones now, while this device is still in the chain. New recovery codes are
                                enough to get back in; a new code is needed to add another device.
                            </p>
                            <div className={styles.actions}>
                                <Button
                                    {...soft}
                                    disabled={busy}
                                    onClick={async () => {
                                        if (await dispatch(renewRecoveryCodes())) dispatch(checkedCodes());
                                    }}
                                >
                                    New recovery codes
                                </Button>
                                <Button size="small" color="inherit" onClick={onReplaceCode}>
                                    A new code…
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className={styles.text}>Without them, a lost device can't get back into the chain.</p>
                            <div className={styles.actions}>
                                <Button {...soft} onClick={() => dispatch(checkedCodes())}>
                                    Yes, I have them
                                </Button>
                                <Button size="small" color="inherit" onClick={() => setLostCodes(true)}>
                                    No
                                </Button>
                            </div>
                        </>
                    )}
                </Alert>
            )}
        </>
    );
};
