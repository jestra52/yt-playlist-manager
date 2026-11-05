import { describe, it, expect } from 'vitest';
import { formatRecoveryCode, isRecoveryCode, normalizeRecoveryCode, recoveryCodeProblem } from './recovery-code';

const CODE = '7K3QD-M9X2A-0P1RT-VWYZ5';

describe('recovery codes', () => {
    it('reads a code however it was typed', () => {
        expect(normalizeRecoveryCode(CODE)).toBe('7K3QDM9X2A0P1RTVWYZ5');
        expect(normalizeRecoveryCode(' 7k3qd m9x2a-op1rt vwyz5 ')).toBe('7K3QDM9X2A0P1RTVWYZ5');
        expect(normalizeRecoveryCode('il')).toBe('11');
        expect(isRecoveryCode('7k3qdm9x2aop1rtvwyz5')).toBe(true);
    });

    it('shows a code in groups of five', () => {
        expect(formatRecoveryCode('7k3qdm9x2a0p1rtvwyz5')).toBe(CODE);
        expect(formatRecoveryCode('7k3q')).toBe('7K3Q');
    });

    it('explains what is wrong, but not while it is still being typed', () => {
        expect(recoveryCodeProblem('7K3QD-M9')).toBe('');
        expect(recoveryCodeProblem('7K3QD-M9', { complete: true })).toMatch(/has 20 characters; this has 7/);
        expect(recoveryCodeProblem('UUUUU-#')).toBe("A recovery code doesn't have U, #.");
        expect(recoveryCodeProblem(`${CODE}-A`)).toMatch(/this has 21/);
        expect(isRecoveryCode('7K3QD')).toBe(false);
        expect(isRecoveryCode('UUUUUUUUUUUUUUUUUUUU')).toBe(false);
    });
});
