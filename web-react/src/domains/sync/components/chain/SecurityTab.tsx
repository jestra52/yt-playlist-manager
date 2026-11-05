import Button from '@mui/material/Button';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import type { AppThunk } from '../../../../app/store';
import { deleteChain, leaveChain, renewRecoveryCodes, replaceCode } from '../../chain.thunks';
import fields from '../settings/Field.module.scss';
import styles from './SecurityTab.module.scss';

type Action = 'replace' | 'codes' | 'leave' | 'delete';

const WORK: Record<Action, () => AppThunk<Promise<boolean>>> = {
    replace: replaceCode,
    codes: renewRecoveryCodes,
    leave: leaveChain,
    delete: deleteChain,
};

const WARNINGS: Record<Action, string> = {
    replace:
        'The current code and recovery codes stop working and every other device is removed; add them again with the new code.',
    codes: 'The current recovery codes stop working. The chain code and the devices stay as they are.',
    leave: 'This device stops syncing. Its playlists stay here, and the other devices keep the chain.',
    delete: "Deletes the chain and the server's copy of its playlists, and removes every device. Playlists on each device stay on that device.",
};

export const SecurityTab = ({ replacing }: { replacing: boolean }) => {
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();
    const [confirming, setConfirming] = useState<Action | null>(replacing ? 'replace' : null);

    const act = (action: Action) => {
        if (confirming !== action) {
            setConfirming(action);
            return;
        }
        setConfirming(null);
        dispatch(WORK[action]());
    };

    const warning = (action: Action) =>
        confirming === action && (
            <p className={action === 'delete' ? styles.danger : styles.warning} role="alert">
                {WARNINGS[action]}
            </p>
        );

    const safe = (action: Action) =>
        confirming === action
            ? ({ variant: 'contained', color: 'warning' } as const)
            : ({ variant: 'contained', color: 'inherit', className: fields.soft } as const);

    return (
        <>
            <section className={styles.action}>
                <p className={styles.when}>Use this if the code leaked or a device was lost.</p>
                <Button {...safe('replace')} size="small" disabled={busy} onClick={() => act('replace')}>
                    {confirming === 'replace' ? 'Yes, new code and remove other devices' : 'Generate a new code'}
                </Button>
                {warning('replace')}
            </section>
            <section className={styles.action}>
                <p className={styles.when}>Use this if you used or lost your recovery codes.</p>
                <Button {...safe('codes')} size="small" disabled={busy} onClick={() => act('codes')}>
                    {confirming === 'codes' ? 'Yes, new recovery codes' : 'Generate new recovery codes'}
                </Button>
                {warning('codes')}
            </section>
            <section className={styles.risky} aria-labelledby="leave-or-delete">
                <h3 id="leave-or-delete" className={styles.title}>
                    Leave or delete
                </h3>
                <div className={styles.buttons}>
                    <Button
                        size="small"
                        color="warning"
                        variant={confirming === 'leave' ? 'contained' : 'outlined'}
                        disabled={busy}
                        onClick={() => act('leave')}
                    >
                        {confirming === 'leave' ? 'Yes, leave' : 'Leave this chain'}
                    </Button>
                    <Button
                        size="small"
                        color="error"
                        variant={confirming === 'delete' ? 'contained' : 'outlined'}
                        disabled={busy}
                        onClick={() => act('delete')}
                    >
                        {confirming === 'delete' ? 'Yes, delete it for every device' : 'Delete the sync chain'}
                    </Button>
                </div>
                {warning('leave')}
                {warning('delete')}
            </section>
        </>
    );
};
