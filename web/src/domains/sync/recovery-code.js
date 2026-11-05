/**
 * Recovery codes: 20 characters of Crockford base32 (100 random bits) made by the
 * server, shown in groups of five like `7K3QD-M9X2A-…`. Each one recovers the sync
 * chain once, from any device. Typed codes are read case-insensitively, without
 * dashes or spaces, and with O read as 0 and I or L as 1, the same way the server
 * reads them.
 *
 * No framework code here: this module is shared as is with other apps (#23).
 */

export const RECOVERY_CODE_LENGTH = 20;

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SAME_AS = { O: '0', I: '1', L: '1' };

/** The characters of a typed code that count: upper case, without dashes or spaces, O as 0, I and L as 1. */
export const normalizeRecoveryCode = (text) => {
    return (text ?? '')
        .toUpperCase()
        .replace(/[\s-]+/g, '')
        .replace(/[OIL]/g, (c) => SAME_AS[c]);
};

/** A canonical code in groups of five, as it's shown. */
export const formatRecoveryCode = (text) => {
    return (normalizeRecoveryCode(text).match(/.{1,5}/g) ?? []).join('-');
};

/**
 * What is wrong with a typed code, ready to show, or '' when it can be sent. Codes
 * that aren't typed in full yet aren't wrong yet: they're answered with ''.
 */
export const recoveryCodeProblem = (text, { complete = false } = {}) => {
    const code = normalizeRecoveryCode(text);
    const wrong = [...new Set([...code].filter((c) => !ALPHABET.includes(c)))];
    if (wrong.length) return `A recovery code doesn't have ${wrong.join(', ')}.`;
    if (code.length > RECOVERY_CODE_LENGTH) {
        return `A recovery code has ${RECOVERY_CODE_LENGTH} characters; this has ${code.length}.`;
    }
    if (complete && code.length < RECOVERY_CODE_LENGTH) {
        return `A recovery code has ${RECOVERY_CODE_LENGTH} characters; this has ${code.length}.`;
    }
    return '';
};

/** True when a typed code has the right characters and length to be sent. */
export const isRecoveryCode = (text) => {
    return normalizeRecoveryCode(text).length === RECOVERY_CODE_LENGTH && !recoveryCodeProblem(text);
};
