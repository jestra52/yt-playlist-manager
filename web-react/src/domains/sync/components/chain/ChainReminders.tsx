import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { renewRecoveryCodes } from '../../chain.thunks';
import { selectCheckInDue, selectPairingPaused, selectRecoveryNotice } from '../../sync.selectors';
import { checkedCodes } from '../../sync.thunks';
import { Notice } from '../settings/Notice';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export const ChainReminders = ({ onReplaceCode }: { onReplaceCode: () => void }) => {
    const paused = useAppSelector(selectPairingPaused);
    const recoveryNotice = useAppSelector(selectRecoveryNotice);
    const checkInDue = useAppSelector(selectCheckInDue);
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();
    const [lostCodes, setLostCodes] = useState(false);

    return (
        <>
            {paused && (
                <Notice tone="warning" role="alert">
                    <p className="m-0 font-semibold">Adding devices with a pairing code is paused</p>
                    <p className="mt-1 mb-0">
                        Someone was refused several times while trying to join this chain, so pairing codes don't work
                        until {timeFormat.format(new Date(paused))}. If you don't know who it was, generate a new code
                        in Security; you can still add a device with the chain code.
                    </p>
                </Notice>
            )}
            {recoveryNotice && (
                <Notice tone="warning" role="status">
                    <p className="m-0 font-semibold">Add another device or recovery codes so you don't lose access</p>
                    <p className="mt-1 mb-0">
                        This is the only device in the chain, and the chain has no recovery codes. If you lose this
                        device and the code, nobody can get the chain back.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button
                            className="btn btn-sm"
                            type="button"
                            disabled={busy}
                            onClick={() => dispatch(renewRecoveryCodes())}
                        >
                            Create recovery codes
                        </button>
                    </div>
                </Notice>
            )}
            {!recoveryNotice && checkInDue && (
                <Notice tone="info" role="status">
                    <p className="m-0 font-semibold">Do you still have your sync chain code and recovery codes?</p>
                    {lostCodes ? (
                        <>
                            <p className="mt-1 mb-0">
                                Make new ones now, while this device is still in the chain. New recovery codes are
                                enough to get back in; a new code is needed to add another device.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                    className="btn btn-sm"
                                    type="button"
                                    disabled={busy}
                                    onClick={async () => {
                                        if (await dispatch(renewRecoveryCodes())) dispatch(checkedCodes());
                                    }}
                                >
                                    New recovery codes
                                </button>
                                <button className="btn btn-ghost btn-sm" type="button" onClick={onReplaceCode}>
                                    A new code…
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="mt-1 mb-0">Without them, a lost device can't get back into the chain.</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <button className="btn btn-sm" type="button" onClick={() => dispatch(checkedCodes())}>
                                    Yes, I have them
                                </button>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    type="button"
                                    onClick={() => setLostCodes(true)}
                                >
                                    No
                                </button>
                            </div>
                        </>
                    )}
                </Notice>
            )}
        </>
    );
};
