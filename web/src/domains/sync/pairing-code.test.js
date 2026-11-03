import { describe, it, expect } from 'vitest';
import { formatPairingCode, isPairingCode, normalizePairingCode, pairingCodeProblem } from './pairing-code.js';

describe('pairing codes', () => {
    it('reads typed codes like the server does', () => {
        expect(normalizePairingCode(' 7k3q-d9x2 ')).toBe('7K3QD9X2');
        expect(normalizePairingCode('OIL0-0000')).toBe('01100000');
        expect(formatPairingCode('7k3qd9x2')).toBe('7K3Q-D9X2');
    });

    it('accepts only 8 characters of the alphabet', () => {
        expect(isPairingCode('7K3Q-D9X2')).toBe(true);
        expect(isPairingCode('7K3Q-D9X')).toBe(false);
        expect(isPairingCode('7K3Q-D9XU')).toBe(false);
        expect(pairingCodeProblem('7K3Q')).toBe('');
        expect(pairingCodeProblem('7K3Q-U')).toBe('A pairing code doesn’t have U.');
        expect(pairingCodeProblem('7K3Q-D9X2-1')).toBe('A pairing code has 8 characters; this has 9.');
    });
});
