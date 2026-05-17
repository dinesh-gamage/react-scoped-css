import { describe, it, expect } from 'vitest';
import { isExcluded } from '../../src/shared/exclude';

describe('isExcluded', () => {
    it('returns false when no prefixes configured', () => {
        expect(isExcluded('foo', [])).toBe(false);
    });

    it('returns true for exact prefix match', () => {
        expect(isExcluded('uxp-button', ['uxp-'])).toBe(true);
    });

    it('returns false when class does not start with prefix', () => {
        expect(isExcluded('button', ['uxp-'])).toBe(false);
    });

    it('handles multiple prefixes', () => {
        const exclude = ['uxp-', 'global-', 'app-'];
        expect(isExcluded('global-header', exclude)).toBe(true);
        expect(isExcluded('app-container', exclude)).toBe(true);
        expect(isExcluded('my-container', exclude)).toBe(false);
    });

    it('is case-sensitive', () => {
        expect(isExcluded('UXP-button', ['uxp-'])).toBe(false);
        expect(isExcluded('uxp-button', ['uxp-'])).toBe(true);
    });
});
