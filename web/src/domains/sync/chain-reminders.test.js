import { describe, it, expect } from 'vitest';
import { CHECK_IN_INTERVAL_MS, isCheckInDue, needsRecoveryNotice } from './chain-reminders.js';

const device = (id) => ({ id, name: id, createdAt: 1, lastSeenAt: 1 });

describe('chain reminders', () => {
    it('warns when the only device has no recovery codes left', () => {
        expect(needsRecoveryNotice({ devices: [device('a')], recoveryCodesLeft: 0 })).toBe(true);
        expect(needsRecoveryNotice({ devices: [device('a')] })).toBe(true);
        expect(needsRecoveryNotice({ devices: [device('a')], recoveryCodesLeft: 10 })).toBe(false);
        expect(needsRecoveryNotice({ devices: [device('a'), device('b')], recoveryCodesLeft: 0 })).toBe(false);
        expect(needsRecoveryNotice(null)).toBe(false);
    });

    it('checks in every 90 days', () => {
        const now = 1_000 * CHECK_IN_INTERVAL_MS;
        expect(isCheckInDue(now - CHECK_IN_INTERVAL_MS, now)).toBe(true);
        expect(isCheckInDue(now - CHECK_IN_INTERVAL_MS + 1, now)).toBe(false);
        expect(isCheckInDue(null, now)).toBe(false);
    });
});
