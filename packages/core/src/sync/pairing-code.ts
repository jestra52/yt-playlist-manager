/**
 * Pairing codes: 8 characters of Crockford base32 made by the server on a device
 * that's in the sync chain, shown as `7K3Q-D9X2`. A new device enters one instead
 * of the 24-word chain code; it works once, for 10 minutes, and only after the
 * device that made it approves. Typed codes are read like recovery codes.

 */
import { normalizeRecoveryCode } from './recovery-code';

export const PAIRING_CODE_LENGTH = 8;

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** The characters of a typed code that count: upper case, without dashes or spaces, O as 0, I and L as 1. */
export const normalizePairingCode = (text: string | null | undefined): string => normalizeRecoveryCode(text);

/** A code as it's shown: two groups of four. */
export const formatPairingCode = (text: string): string => {
    return (normalizePairingCode(text).match(/.{1,4}/g) ?? []).join('-');
};

/** True when a typed code has the right characters and length to be sent. */
export const isPairingCode = (text: string): boolean => {
    const code = normalizePairingCode(text);
    return code.length === PAIRING_CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
};

/**
 * What is wrong with a typed code, ready to show, or '' when it can be sent (or
 * isn't typed in full yet).
 */
export const pairingCodeProblem = (text: string): string => {
    const code = normalizePairingCode(text);
    const wrong = [...new Set([...code].filter((c) => !ALPHABET.includes(c)))];
    if (wrong.length) return `A pairing code doesn't have ${wrong.join(', ')}.`;
    if (code.length > PAIRING_CODE_LENGTH) {
        return `A pairing code has ${PAIRING_CODE_LENGTH} characters; this has ${code.length}.`;
    }
    return '';
};
