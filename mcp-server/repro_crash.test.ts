
import { describe, it, expect } from 'vitest';

type MockUnit = { name: string | null; isc?: string };

describe('Search Units Crash Reproduction', () => {
    it('safely handles missing name or isc using fixed logic', () => {
        const units: MockUnit[] = [
            { name: 'Fusilier', isc: 'Fusilier' },
            { name: null, isc: 'Something' }, // Bad unit
        ];

        const query = 'fusilier';
        const q = query.toLowerCase();

        // This uses the FIXED safe logic
        const results = units.filter(u => (u.name?.toLowerCase() || '').includes(q) || (u.isc?.toLowerCase() || '').includes(q));

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Fusilier');
    });

    it('does not crash with safe access', () => {
        const units: MockUnit[] = [
            { name: 'Fusilier', isc: 'Fusilier' },
            { name: null, isc: 'Something' },
            { name: 'Legionnaire', isc: undefined }
        ];

        const query = 'fusilier';
        const q = query.toLowerCase();

        // Use safe access
        const results = units.filter(u =>
            (u.name?.toLowerCase() || '').includes(q) ||
            (u.isc?.toLowerCase() || '').includes(q)
        );

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Fusilier');
    });
});
