import { scanCode, type ScannedCode } from '@ytpm/core/sync/qr-scan';
import { useEffect, useRef, useState } from 'react';

export const QrScanner = ({ onScan, onCancel }: { onScan: (code: ScannedCode) => void; onCancel: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const foundRef = useRef(onScan);
    const [problem, setProblem] = useState('');

    useEffect(() => {
        foundRef.current = onScan;
    });

    useEffect(() => {
        const stop = new AbortController();
        scanCode(videoRef.current!, { signal: stop.signal })
            .then((code) => {
                if (code) foundRef.current(code);
            })
            .catch((err: Error) => setProblem(err.message));
        return () => stop.abort();
    }, []);

    return (
        <div className="rounded-box border-base-300 border p-2">
            {problem ? (
                <p className="text-error mt-0 mb-2 text-center text-sm" role="alert">
                    {problem}
                </p>
            ) : (
                <p className="text-base-content/65 mt-0 mb-2 text-center text-sm">
                    Point the camera at the QR code shown on your other device.
                </p>
            )}
            <video
                ref={videoRef}
                className={problem ? 'hidden' : 'rounded-box block aspect-square max-h-72 w-full bg-black object-cover'}
                muted
                playsInline
                aria-label="Camera"
            />
            <div className="mt-2 flex justify-end">
                <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>
                    Close camera
                </button>
            </div>
        </div>
    );
};
