import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { claimLegacyChain } from '../../chain.thunks';
import { Notice } from '../settings/Notice';

export const LegacyClaim = ({ deviceName }: { deviceName: string }) => {
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();

    return (
        <Notice tone="info">
            <p className="m-0 font-semibold">Your synced playlists can become a sync chain</p>
            <p className="mt-1 mb-0">
                This device synced with the old shared sync token. Turn that library into a sync chain to keep syncing
                it; you'll get its code to add your other devices.
            </p>
            <button
                className="btn btn-primary btn-sm mt-2"
                type="button"
                disabled={busy}
                onClick={() => dispatch(claimLegacyChain(deviceName))}
            >
                Turn it into a sync chain
            </button>
        </Notice>
    );
};
