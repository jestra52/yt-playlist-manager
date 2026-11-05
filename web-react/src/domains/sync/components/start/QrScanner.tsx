import Button from '@mui/material/Button';
import { scanCode, type ScannedCode } from '@ytpm/core/sync/qr-scan';
import { useEffect, useRef, useState } from 'react';
import styles from './QrScanner.module.scss';

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
        <div className={styles.scanner}>
            {problem ? (
                <p className={styles.problem} role="alert">
                    {problem}
                </p>
            ) : (
                <p className={styles.hint}>Point the camera at the QR code shown on your other device.</p>
            )}
            <video
                ref={videoRef}
                className={problem ? styles.off : styles.video}
                muted
                playsInline
                aria-label="Camera"
            />
            <div className={styles.close}>
                <Button size="small" color="inherit" onClick={onCancel}>
                    Close camera
                </Button>
            </div>
        </div>
    );
};
