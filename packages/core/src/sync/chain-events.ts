/**
 * Sentences for the entries of a sync chain's audit log, e.g. "Chrome on Windows
 * removed Phone". The server only sends names and kinds, never a secret.

 */
import type { ChainEvent } from './sync.client';

const SENTENCES: Record<string, (who: string, detail: string) => string> = {
    created: (who) => `${who} created the sync chain`,
    claimed: (who) => `${who} turned the synced playlists into a sync chain`,
    device_joined: (who) => `${who} joined`,
    device_left: (who) => `${who} left`,
    device_removed: (who, detail) => `${who} removed ${detail || 'a device'}`,
    code_replaced: (who) => `${who} generated a new code and new recovery codes`,
    recovered: (who) => `${who} recovered the chain with a recovery code`,
    recovery_codes_renewed: (who) => `${who} generated new recovery codes`,
    pairing_started: (who) => `${who} created a pairing code`,
    pairing_approved: (who, detail) => `${who} let ${detail || 'a device'} join with a pairing code`,
    pairing_denied: (who, detail) => `${who} refused ${detail || 'a device'}`,
    pairing_blocked: (who) => `${who} tried to join with a pairing code that was already used`,
    pairing_locked: () => 'Adding devices with a pairing code was paused for an hour after repeated refused attempts',
};

/** One entry ({ kind, deviceName, detail }) as a sentence; devices removed by a new code are named after it. */
export const describeEvent = ({ kind, deviceName, detail = '' }: Omit<ChainEvent, 'at'>): string => {
    const who = deviceName || 'A device';
    const sentence = SENTENCES[kind]?.(who, detail) ?? `${who}: ${kind}`;
    const removed = (kind === 'code_replaced' || kind === 'recovered') && detail ? ` (${detail})` : '';
    return sentence + removed;
};
