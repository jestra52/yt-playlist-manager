/**
 * Scanning a code's QR code with the camera, to join a sync chain on a phone
 * without typing: the 24-word chain code (shown when it's saved) or a pairing code
 * (shown while adding a device). Uses the browser's BarcodeDetector where there is
 * one, and jsQR (loaded only then) everywhere else. Nothing leaves the device.
 *
 * No framework code here: this module is shared as is with other apps (#23).
 */
import { WORD_COUNT, splitWords } from './chain-code.js';
import { formatPairingCode, isPairingCode } from './pairing-code.js';

const SCAN_INTERVAL_MS = 250;

/**
 * What a scanned QR code holds: { kind: 'pairing', code } for a pairing code,
 * { kind: 'chain', text } for 24 words, or null for anything else.
 */
export const readScannedCode = (text) => {
    const value = (text ?? '').trim();
    if (isPairingCode(value)) return { kind: 'pairing', code: formatPairingCode(value) };
    const words = splitWords(value);
    if (words.length === WORD_COUNT) return { kind: 'chain', text: words.join(' ') };
    return null;
};

/** True when this browser can show the camera at all (it may still be refused). */
export const canScan = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

/** A function that reads the text of a QR code in a video frame, or null when there's none. */
const createDecoder = async () => {
    if ('BarcodeDetector' in globalThis) {
        const formats = await globalThis.BarcodeDetector.getSupportedFormats?.().catch(() => []);
        if (formats?.includes('qr_code')) {
            const detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] });
            return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
        }
    }
    const { default: jsQR } = await import('jsqr');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    return async (video) => {
        const { videoWidth: width, videoHeight: height } = video;
        if (!width || !height) return null;
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        return jsQR(context.getImageData(0, 0, width, height).data, width, height)?.data ?? null;
    };
};

/** A message ready to show for a camera that couldn't be opened. */
const cameraProblem = (err) => {
    if (err?.name === 'NotAllowedError') return 'The camera isn’t allowed. Allow it in the browser, or type the code.';
    if (err?.name === 'NotFoundError') return 'No camera found. Type the code instead.';
    return 'The camera couldn’t be opened. Type the code instead.';
};

/**
 * Shows the back camera in `video` and looks for a chain code or pairing code until
 * one is found (resolves to it, see readScannedCode) or `signal` aborts (resolves to
 * null). The camera is turned off either way. Throws an Error with a message ready
 * to show when the camera can't be opened.
 */
export const scanCode = async (video, { signal } = {}) => {
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch (err) {
        throw new Error(cameraProblem(err), { cause: err });
    }
    try {
        video.srcObject = stream;
        video.setAttribute('playsinline', '');
        await video.play();
        const decode = await createDecoder();
        while (!signal?.aborted) {
            const code = readScannedCode(await decode(video).catch(() => null));
            if (code) return code;
            await new Promise((resolve) => {
                setTimeout(resolve, SCAN_INTERVAL_MS);
            });
        }
        return null;
    } finally {
        for (const track of stream.getTracks()) track.stop();
        video.srcObject = null;
    }
};
