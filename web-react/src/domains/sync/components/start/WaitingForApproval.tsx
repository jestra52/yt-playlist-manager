import { countdown } from '@ytpm/core/sync/pairing';
import { useAppDispatch } from '../../../../app/store';
import { useNow } from '../../../../shared/useNow';
import { cancelJoinRequest } from '../../pairing.thunks';
import { Notice } from '../settings/Notice';

export const WaitingForApproval = ({ deviceName, expiresAt }: { deviceName: string; expiresAt: number }) => {
    const now = useNow(1000);
    const dispatch = useAppDispatch();

    return (
        <Notice tone="info" role="status" icon={<span className="loading loading-spinner loading-xs" />}>
            <p className="m-0 font-semibold">Waiting for approval</p>
            <p className="mt-1 mb-0">
                Allow "{deviceName || 'this device'}" on the device that shows the pairing code. Time left:{' '}
                {countdown(expiresAt, now)}.
            </p>
            <button className="btn btn-ghost btn-sm mt-2" type="button" onClick={() => dispatch(cancelJoinRequest())}>
                Cancel
            </button>
        </Notice>
    );
};
