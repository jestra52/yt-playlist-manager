import { countdown } from '@ytpm/core/sync/pairing';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { useNow } from '../../../../shared/useNow';
import { approvePairing, denyPairing } from '../../pairing.thunks';
import { Notice } from '../settings/Notice';

export const PairingRequest = ({ requesterName, expiresAt }: { requesterName: string; expiresAt: number }) => {
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();
    const now = useNow(1000);

    return (
        <Notice tone="info" role="alertdialog" labelledBy="pairing-ask">
            <p id="pairing-ask" className="m-0 font-semibold">
                Allow {requesterName || 'this device'} to join?
            </p>
            <p className="mt-1 mb-0">
                It will sync every playlist in this chain. Only allow it if it's your device and you just entered the
                code on it. Answer within {countdown(expiresAt, now)}.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
                <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    disabled={busy}
                    onClick={() => dispatch(approvePairing())}
                >
                    Allow
                </button>
                <button className="btn btn-sm" type="button" disabled={busy} onClick={() => dispatch(denyPairing())}>
                    Deny
                </button>
            </div>
        </Notice>
    );
};
