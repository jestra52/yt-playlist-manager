import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import type { AppThunk } from '../../../../app/store';
import { deleteChain, leaveChain, renewRecoveryCodes, replaceCode } from '../../chain.thunks';

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
            <p className={`mt-2 mb-0 ${action === 'delete' ? 'text-error' : 'text-warning'}`} role="alert">
                {WARNINGS[action]}
            </p>
        );

    const safe = (action: Action) => `btn btn-sm ${confirming === action ? 'btn-warning' : ''}`;

    return (
        <>
            <section className="mb-4">
                <p className="text-base-content/65 mt-0 mb-2">Use this if the code leaked or a device was lost.</p>
                <button className={safe('replace')} type="button" disabled={busy} onClick={() => act('replace')}>
                    {confirming === 'replace' ? 'Yes, new code and remove other devices' : 'Generate a new code'}
                </button>
                {warning('replace')}
            </section>
            <section className="mb-4">
                <p className="text-base-content/65 mt-0 mb-2">Use this if you used or lost your recovery codes.</p>
                <button className={safe('codes')} type="button" disabled={busy} onClick={() => act('codes')}>
                    {confirming === 'codes' ? 'Yes, new recovery codes' : 'Generate new recovery codes'}
                </button>
                {warning('codes')}
            </section>
            <section className="border-base-300 mt-6 border-t pt-4" aria-labelledby="leave-or-delete">
                <h3 id="leave-or-delete" className="mt-0 mb-2 text-base font-semibold">
                    Leave or delete
                </h3>
                <div className="flex flex-wrap gap-2">
                    <button
                        className={`btn btn-sm btn-warning ${confirming === 'leave' ? '' : 'btn-outline'}`}
                        type="button"
                        disabled={busy}
                        onClick={() => act('leave')}
                    >
                        {confirming === 'leave' ? 'Yes, leave' : 'Leave this chain'}
                    </button>
                    <button
                        className={`btn btn-sm btn-error ${confirming === 'delete' ? '' : 'btn-outline'}`}
                        type="button"
                        disabled={busy}
                        onClick={() => act('delete')}
                    >
                        {confirming === 'delete' ? 'Yes, delete it for every device' : 'Delete the sync chain'}
                    </button>
                </div>
                {warning('leave')}
                {warning('delete')}
            </section>
        </>
    );
};
