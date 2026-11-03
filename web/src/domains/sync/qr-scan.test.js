import { describe, it, expect } from 'vitest';
import { secretToWords } from './chain-code.js';
import { readScannedCode } from './qr-scan.js';

const SECRET = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';

describe('reading a scanned QR code', () => {
    it('recognizes the chain code’s 24 words and pairing codes', () => {
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
