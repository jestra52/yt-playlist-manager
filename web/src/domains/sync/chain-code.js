import { entropyToMnemonic, mnemonicToEntropy } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

/**
 * A sync chain's code: its 256-bit secret written as 24 words from the standard
 * BIP-39 English list. The last word carries a checksum, so a mistyped or
 * swapped word is caught here, before anything is sent to the server. The
 * server only ever sees the secret (base64url), never the words.
 *
 * No framework code here: this module is shared as is with other apps (#23).
 */

export const WORD_COUNT = 24;

const toBase64Url = (bytes) => {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text) => {
    const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

/** The 24 words for a secret from the server (32 bytes, base64url). */
export const secretToWords = (secret) => {
    const bytes = fromBase64Url(secret);
    if (bytes.length !== 32) throw new Error('A sync chain secret is 32 bytes');
    return entropyToMnemonic(bytes, wordlist).split(' ');
};

/**
 * Lower-case words from typed or pasted text, ignoring numbering ("1." or "1)"),
 * commas and extra spaces. When the words are numbered, only the numbered ones
 * count, so the whole downloaded code file (with its explanation) can be pasted.
 */
export const splitWords = (text) => {
    const lower = (text ?? '').toLowerCase();
    const numbered = [...lower.matchAll(/\b\d+\s*[.)]\s*([a-z]+)/g)].map((m) => m[1]);
    if (numbered.length >= WORD_COUNT) return numbered;
    return lower
        .replace(/\b\d+[.)]/g, ' ')
        .split(/[^a-z]+/)
        .filter(Boolean);
};

export class ChainCodeError extends Error {}

/**
 * The secret (base64url) for typed or pasted words. Throws ChainCodeError with
 * a message ready to show: wrong number of words, words that aren't in the
 * list, or a checksum that doesn't match (a word mistyped or out of order).
 */
export const wordsToSecret = (text) => {
    const words = splitWords(text);
    if (words.length !== WORD_COUNT) {
        throw new ChainCodeError(`A sync chain code has ${WORD_COUNT} words; this has ${words.length}.`);
    }
    const unknown = words.filter((w) => !wordlist.includes(w));
    if (unknown.length) {
        throw new ChainCodeError(
            `${unknown.length === 1 ? 'This word isn’t' : 'These words aren’t'} in the list: ${unknown.join(', ')}.`,
        );
    }
    try {
        return toBase64Url(mnemonicToEntropy(words.join(' '), wordlist));
    } catch {
        throw new ChainCodeError('The words don’t match: one is mistyped or out of order.');
    }
};

/** `count` different word positions (1-based, in order) to type back after saving the code. */
export const confirmationPositions = (count = 3, random = Math.random) => {
    const positions = new Set();
    while (positions.size < count) positions.add(1 + Math.floor(random() * WORD_COUNT));
    return [...positions].sort((a, b) => a - b);
};

/** The text of the downloaded code file: numbered words, and what to do with them. */
export const chainCodeFileText = (words, appName = 'YouTube Playlist Manager') => {
    const lines = [
        `${appName}: sync chain code`,
        '',
        'Anyone with these 24 words can join your sync chain and see and change your playlists.',
        'Keep them somewhere safe and private, like a password manager.',
        '',
        ...words.map((w, i) => `${String(i + 1).padStart(2, ' ')}. ${w}`),
        '',
    ];
    return lines.join('\r\n');
};

/** A short name for this device, like "Chrome on Windows", from the browser's user agent. */
export const defaultDeviceName = (userAgent = globalThis.navigator?.userAgent ?? '') => {
    const browser = /Edg\//.test(userAgent)
        ? 'Edge'
        : /OPR\//.test(userAgent)
          ? 'Opera'
          : /Firefox\//.test(userAgent)
            ? 'Firefox'
            : /Chrome\//.test(userAgent)
              ? 'Chrome'
              : /Safari\//.test(userAgent)
                ? 'Safari'
                : 'Browser';
    const system = /iPhone|iPad|iPod/.test(userAgent)
        ? 'iOS'
        : /Android/.test(userAgent)
          ? 'Android'
          : /Windows/.test(userAgent)
            ? 'Windows'
            : /Mac OS X|Macintosh/.test(userAgent)
              ? 'macOS'
              : /Linux/.test(userAgent)
                ? 'Linux'
                : '';
    return system ? `${browser} on ${system}` : browser;
};
