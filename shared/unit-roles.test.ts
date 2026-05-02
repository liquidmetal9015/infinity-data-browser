import { describe, it, expect } from 'vitest';
import { classifyUnit } from './unit-roles';
import { UnitType } from './game-model.js';
import type { Unit } from './types';
import type { Profile, Loadout as Option } from './game-model.js';

// Minimal mock factories
function createMockUnit(overrides: Partial<Unit> = {}): Unit {
    return {
        id: 1,
        isc: 'TEST_UNIT',
        name: 'Test Unit',
        factions: [1],
        slug: 'test-unit',
        profileGroups: [],
        ...overrides,
    } as Unit;
}

function createMockProfile(overrides: Partial<Profile> = {}): Profile {
    return {
        id: 1,
        name: 'Test Profile',
        mov: '4-4',
        cc: 13,
        bs: 12,
        ph: 10,
        wip: 13,
        arm: 1,
        bts: 0,
        w: 1,
        s: 2,
        ava: 4,
        unitType: UnitType.LI,
        skills: [],
        weapons: [],
        ...overrides,
    } as Profile;
}

function createMockOption(overrides: Partial<Option> = {}): Option {
    return {
        id: 1,
        name: 'Default',
        points: 20,
        swc: 0,
        skills: [],
        weapons: [],
        peripheral: [],
        ...overrides,
    } as Option;
}

describe('unit-roles: scoreHeavy', () => {
    it('scores HI (unitType=3) as heavy', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.HI, arm: 3 });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const heavyRole = result.roles.find(r => r.role === 'heavy');
        expect(heavyRole).toBeDefined();
        expect(heavyRole!.reasons).toContain('Heavy Infantry');
    });

    it('scores TAG (unitType=4) as heavy with high score', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.TAG, arm: 8 });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const heavyRole = result.roles.find(r => r.role === 'heavy');
        expect(heavyRole).toBeDefined();
        expect(heavyRole!.reasons).toContain('TAG');
        expect(heavyRole!.score).toBeGreaterThanOrEqual(40);
    });

    it('does NOT score WB (unitType=7) as TAG in heavy', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.WB, arm: 0 });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const heavyRole = result.roles.find(r => r.role === 'heavy');
        // WB should not have TAG reason
        if (heavyRole) {
            expect(heavyRole.reasons).not.toContain('TAG');
        }
    });

    it('does NOT score SK (unitType=6) as heavy', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.SK, arm: 0 });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const heavyRole = result.roles.find(r => r.role === 'heavy');
        // SK alone should not score as heavy (no type bonus, no ARM, no weapons)
        if (heavyRole) {
            expect(heavyRole.reasons).not.toContain('Heavy Infantry');
            expect(heavyRole.reasons).not.toContain('TAG');
        }
    });

    it('scores high ARM as heavy regardless of type', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.LI, arm: 6 });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const heavyRole = result.roles.find(r => r.role === 'heavy');
        expect(heavyRole).toBeDefined();
        expect(heavyRole!.reasons).toContain('ARM 6');
    });
});

describe('unit-roles: scoreHackTarget', () => {
    it('scores HI (unitType=3) as hackable', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.HI });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const hackRole = result.roles.find(r => r.role === 'hack_target');
        expect(hackRole).toBeDefined();
        expect(hackRole!.reasons).toContain('Heavy Infantry (hackable)');
    });

    it('scores REM (unitType=5) as hackable', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.REM });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const hackRole = result.roles.find(r => r.role === 'hack_target');
        expect(hackRole).toBeDefined();
        expect(hackRole!.reasons).toContain('REM (hackable)');
    });

    it('scores TAG (unitType=4) as hackable with highest score', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.TAG });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const hackRole = result.roles.find(r => r.role === 'hack_target');
        expect(hackRole).toBeDefined();
        expect(hackRole!.reasons).toContain('TAG (hackable)');
        expect(hackRole!.score).toBe(50);
    });

    it('does NOT score SK (unitType=6) as hack target', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.SK });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const hackRole = result.roles.find(r => r.role === 'hack_target');
        expect(hackRole).toBeUndefined();
    });

    it('does NOT score WB (unitType=7) as hack target', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.WB });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const hackRole = result.roles.find(r => r.role === 'hack_target');
        expect(hackRole).toBeUndefined();
    });

    it('does NOT score LI (unitType=1) as hack target', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.LI });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const hackRole = result.roles.find(r => r.role === 'hack_target');
        expect(hackRole).toBeUndefined();
    });
});

describe('unit-roles: classifyUnit integration', () => {
    it('TAG scores as both heavy and hack_target', () => {
        const unit = createMockUnit();
        const profile = createMockProfile({ unitType: UnitType.TAG, arm: 8 });
        const option = createMockOption();
        const result = classifyUnit(unit, profile, option);
        const roleNames = result.roles.map(r => r.role);
        expect(roleNames).toContain('heavy');
        expect(roleNames).toContain('hack_target');
    });

    it('returns correct metadata in analysis', () => {
        const unit = createMockUnit({ name: 'Jotum', isc: 'JOTUM' });
        const profile = createMockProfile({ name: 'Jotum Profile', unitType: UnitType.TAG });
        const option = createMockOption({ name: 'HMG', points: 90, swc: 2 });
        const result = classifyUnit(unit, profile, option);
        expect(result.unitName).toBe('Jotum');
        expect(result.unitIsc).toBe('JOTUM');
        expect(result.profileName).toBe('Jotum Profile');
        expect(result.optionName).toBe('HMG');
        expect(result.points).toBe(90);
        expect(result.swc).toBe(2);
    });
});
