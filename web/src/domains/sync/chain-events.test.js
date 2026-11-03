import { describe, it, expect } from 'vitest';
import { describeEvent } from './chain-events.js';

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
});
