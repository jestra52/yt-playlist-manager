import { describe, it, expect } from 'vitest';
import {
    ChainCodeError,
    WORD_COUNT,
    chainCodeFileText,
    confirmationPositions,
    defaultDeviceName,
    secretToWords,
    splitWords,
    wordsToSecret,
} from './chain-code.js';

// A secret as the server sends it: 32 bytes, base64url without padding (43 characters).
const SECRET = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';

describe('chain code words', () => {
    it('turns a secret into 24 words and back', () => {
        const words = secretToWords(SECRET);
        expect(words).toHaveLength(WORD_COUNT);
        expect(wordsToSecret(words.join(' '))).toBe(SECRET);
    });

    it('reads words however they were saved: numbered, on several lines, in capitals', () => {
        const words = secretToWords(SECRET);
        const saved = words.map((w, i) => `${i + 1}. ${w.toUpperCase()}`).join('\r\n');
        expect(wordsToSecret(saved)).toBe(SECRET);
        expect(wordsToSecret(chainCodeFileText({ words }))).toBe(SECRET);
    });

    it('saves the recovery codes in the same file, and the whole file still joins', () => {
        const words = secretToWords(SECRET);
        const recoveryCodes = ['ABCDE-FGHJK-MNPQR-STVWX', '12345-ABCDE-00000-11111'];
        const text = chainCodeFileText({ words, recoveryCodes });
        expect(text).toContain('    ABCDE-FGHJK-MNPQR-STVWX');
        expect(wordsToSecret(text)).toBe(SECRET);

        const codesOnly = chainCodeFileText({ recoveryCodes });
        expect(codesOnly).toMatch(/^Yuzu Tapes Playlist Manager: recovery codes/);
        expect(codesOnly).not.toContain('24 words');
    });

    it('explains what is wrong with a code', () => {
        const words = secretToWords(SECRET);
        expect(() => wordsToSecret(words.slice(0, 23).join(' '))).toThrow(/24 words; this has 23/);
        expect(() => wordsToSecret([...words.slice(0, 23), 'notaword'].join(' '))).toThrow(/notaword/);
        const swapped = [...words];
        [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
        if (swapped.join(' ') !== words.join(' ')) {
            expect(() => wordsToSecret(swapped.join(' '))).toThrow(ChainCodeError);
        }
    });

    it('splits pasted text into words', () => {
        expect(splitWords(' 1) Apple,  2. banana\n3. cherry ')).toEqual(['apple', 'banana', 'cherry']);
    });

    it('rejects a secret that is not 32 bytes', () => {
        expect(() => secretToWords('AAEC')).toThrow();
    });
});

describe('confirmationPositions', () => {
    it('picks distinct positions within the code, in order', () => {
        let n = 0;
        const sequence = [0.5, 0.5, 0.01, 0.99, 0.3];
        const positions = confirmationPositions(3, () => sequence[n++ % sequence.length]);
        expect(positions).toEqual([1, 13, 24]);
    });
});

describe('defaultDeviceName', () => {
    it.each([
        [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
            'Chrome on Windows',
        ],
        ['Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0', 'Edge on Windows'],
        [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1',
            'Safari on iOS',
        ],
        ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36', 'Chrome on Android'],
        ['Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox on Linux'],
        ['', 'Browser'],
    ])('%s → %s', (ua, name) => {
        expect(defaultDeviceName(ua)).toBe(name);
    });
});
