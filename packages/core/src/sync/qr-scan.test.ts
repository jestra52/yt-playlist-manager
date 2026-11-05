import { afterEach, describe, it, expect, vi } from 'vitest';
import { secretToWords } from './chain-code';
import { canScan, readScannedCode } from './qr-scan';

const SECRET = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';

describe('reading a scanned QR code', () => {
    it("recognizes the chain code's 24 words and pairing codes", () => {
        const words = secretToWords(SECRET);
        expect(readScannedCode(words.join(' '))).toEqual({ kind: 'chain', text: words.join(' ') });
        expect(readScannedCode(` ${words.join('\n')} `)).toEqual({ kind: 'chain', text: words.join(' ') });
        expect(readScannedCode('7k3q-d9x2')).toEqual({ kind: 'pairing', code: '7K3Q-D9X2' });
    });

    it('ignores anything else', () => {
        expect(readScannedCode('https://example.com')).toBeNull();
        expect(readScannedCode(secretToWords(SECRET).slice(0, 12).join(' '))).toBeNull();
        expect(readScannedCode('')).toBeNull();
        expect(readScannedCode(null)).toBeNull();
    });
});

describe('canScan', () => {
    const device = ({
        camera = true,
        mobile,
        coarse = false,
    }: {
        camera?: boolean;
        mobile?: boolean;
        coarse?: boolean;
    }) => {
        vi.stubGlobal('navigator', {
            mediaDevices: camera ? { getUserMedia: () => {} } : {},
            ...(mobile === undefined ? {} : { userAgentData: { mobile } }),
        });
        vi.stubGlobal('matchMedia', () => ({ matches: coarse }));
    };

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('offers scanning on a phone', () => {
        device({ mobile: true });
        expect(canScan()).toBe(true);
    });

    it('uses the pointer on browsers that do not say, and on tablets Chrome calls not mobile', () => {
        device({ coarse: true });
        expect(canScan()).toBe(true);
        device({ mobile: false, coarse: true });
        expect(canScan()).toBe(true);
    });

    it('does not offer scanning on a computer, even with a webcam', () => {
        device({ mobile: false });
        expect(canScan()).toBe(false);
        device({});
        expect(canScan()).toBe(false);
    });

    it('needs a camera', () => {
        device({ camera: false, mobile: true });
        expect(canScan()).toBe(false);
    });
});
