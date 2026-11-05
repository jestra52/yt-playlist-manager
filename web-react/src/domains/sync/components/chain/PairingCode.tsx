import { countdown } from '@ytpm/core/sync/pairing';
import { useAppDispatch } from '../../../../app/store';
import { useNow } from '../../../../shared/useNow';
import { cancelPairing } from '../../pairing.thunks';
import { useQrCode } from '../code/useQrCode';

export const PairingCode = ({ code, expiresAt }: { code: string; expiresAt: number }) => {
    const qr = useQrCode(code);
    const now = useNow(1000);
    const dispatch = useAppDispatch();

    return (
        <div className="rounded-box border-base-300 flex flex-wrap items-center gap-4 border p-3">
            {qr && (
                <img
                    className="rounded-box flex-none bg-white p-1"
                    src={qr}
                    alt="The pairing code as a QR code"
                    width={132}
                    height={132}
                />
            )}
            <div className="min-w-48 flex-1 text-sm">
                <p className="m-0 font-mono text-2xl font-semibold tracking-widest" aria-label="Pairing code">
                    {code}
                </p>
                <p className="text-base-content/65 mt-1 mb-0">
                    On the new device, open sync settings and choose <strong>Enter a pairing code</strong>, or scan
                    this. Expires in {countdown(expiresAt, now)}.
                </p>
                <button className="btn btn-ghost btn-sm mt-2" type="button" onClick={() => dispatch(cancelPairing())}>
                    Cancel
                </button>
            </div>
        </div>
    );
};
