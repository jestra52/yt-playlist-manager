import { describe, it, expect } from 'vitest';
import { describeEvent } from './chain-events';

describe('audit log sentences', () => {
    it('says what happened and from which device', () => {
        expect(describeEvent({ kind: 'device_joined', deviceName: 'Phone', detail: '' })).toBe('Phone joined');
        expect(describeEvent({ kind: 'device_removed', deviceName: 'Laptop', detail: 'Phone' })).toBe(
            'Laptop removed Phone',
        );
        expect(describeEvent({ kind: 'recovered', deviceName: 'New phone', detail: 'removed Laptop, Phone' })).toBe(
            'New phone recovered the chain with a recovery code (removed Laptop, Phone)',
        );
        expect(describeEvent({ kind: 'code_replaced', deviceName: 'Laptop', detail: '' })).toBe(
            'Laptop generated a new code and new recovery codes',
        );
        expect(describeEvent({ kind: 'something_new', deviceName: '', detail: '' })).toBe('A device: something_new');
    });

    it('describes pairing', () => {
        expect(describeEvent({ kind: 'pairing_started', deviceName: 'Laptop', detail: '' })).toBe(
            'Laptop created a pairing code',
        );
        expect(describeEvent({ kind: 'pairing_approved', deviceName: 'Laptop', detail: 'Chrome on Android' })).toBe(
            'Laptop let Chrome on Android join with a pairing code',
        );
        expect(describeEvent({ kind: 'pairing_denied', deviceName: 'Laptop', detail: 'Unknown' })).toBe(
            'Laptop refused Unknown',
        );
        expect(describeEvent({ kind: 'pairing_blocked', deviceName: 'Phone', detail: '' })).toBe(
            'Phone tried to join with a pairing code that was already used',
        );
        expect(describeEvent({ kind: 'pairing_locked', deviceName: '', detail: '' })).toMatch(
            /^Adding devices .* paused/,
        );
    });
});
