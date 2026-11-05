import { canScan } from '@ytpm/core/sync/qr-scan';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { createChain } from '../../chain.thunks';
import type { StartMode } from './StartScreen';

interface ChooseWayProps {
    deviceName: string;
    onMode: (mode: StartMode) => void;
    onScan: () => void;
}

export const ChooseWay = ({ deviceName, onMode, onScan }: ChooseWayProps) => {
    const busy = useAppSelector((state) => state.sync.busy);
    const dispatch = useAppDispatch();

    return (
        <>
            <div className="grid gap-3 sm:grid-cols-3">
                <button className="btn" type="button" disabled={busy} onClick={() => dispatch(createChain(deviceName))}>
                    {busy && <span className="loading loading-spinner loading-xs" />}
                    Create a sync chain
                </button>
                <button className="btn" type="button" disabled={busy} onClick={() => onMode('pair')}>
                    Enter a pairing code
                </button>
                <button className="btn" type="button" disabled={busy} onClick={() => onMode('join')}>
                    Enter the chain code
                </button>
            </div>
            {canScan() && (
                <p className="mt-3 mb-0 text-center text-sm">
                    <button className="link p-0" type="button" disabled={busy} onClick={onScan}>
                        Scan a QR code instead
                    </button>
                </p>
            )}
            <p className="text-base-content/65 mt-3 mb-0 text-center text-sm">
                Lost every device and the code?{' '}
                <button className="link p-0" type="button" disabled={busy} onClick={() => onMode('recover')}>
                    Recover with a recovery code
                </button>
            </p>
        </>
    );
};
