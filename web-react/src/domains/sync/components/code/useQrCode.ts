import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** `text` as a QR code image, or '' until it's ready or when there's no text. */
export const useQrCode = (text: string): string => {
    const [image, setImage] = useState('');

    useEffect(() => {
        if (!text) return undefined;
        let current = true;
        QRCode.toDataURL(text, { margin: 1, width: 132, errorCorrectionLevel: 'M' })
            .then((url) => {
                if (current) setImage(url);
            })
            .catch(() => {
                if (current) setImage('');
            });
        return () => {
            current = false;
        };
    }, [text]);

    return text ? image : '';
};
