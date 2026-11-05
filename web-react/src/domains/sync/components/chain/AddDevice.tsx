import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { cancelPairing, startPairing } from '../../pairing.thunks';
import { selectPairingPaused } from '../../sync.selectors';
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
        <button className="btn btn-sm" type="button" disabled={busy} onClick={() => dispatch(startPairing())}>
            {label}
        </button>
    );

    return (
        <section className="mt-4" aria-labelledby="add-device-title">
            <h3 id="add-device-title" className="mt-0 mb-2 text-base font-semibold">
                Add a device
            </h3>
            {!pairing && (
                <>
                    <p className="text-base-content/65 mt-0 mb-2">
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
                <p className="text-base-content/65 m-0 flex items-center gap-2">
                    <span className="loading loading-spinner loading-xs" /> Allowed. Waiting for{' '}
                    {name || 'the new device'} to finish joining…
                </p>
            )}
            {pairing && ['joined', 'denied', 'expired'].includes(pairing.status) && (
                <>
                    <p className="mt-0 mb-2" role="status">
                        {pairing.status === 'joined' && `${name || 'The new device'} joined the chain.`}
                        {pairing.status === 'denied' && `Refused. ${name || 'That device'} didn't join.`}
                        {pairing.status === 'expired' && 'The pairing code expired.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {start('Show a new pairing code')}
                        <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            onClick={() => dispatch(cancelPairing())}
                        >
                            Done
                        </button>
                    </div>
                </>
            )}
        </section>
    );
};
