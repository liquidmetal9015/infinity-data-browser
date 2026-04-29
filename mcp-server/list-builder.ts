import { DatabaseAdapter } from './DatabaseAdapter.js';
import { encodeArmyList } from '../shared/armyCode.js';

interface UnitEntry {
    unitId: number;
    unitName: string;
    profileGroupId: number;
    optionId: number;
    points: number;
    swc: number;
}

interface ListState {
    factionSlug: string;
    factionId: number;
    armyName: string;
    pointsLimit: number;
    groups: UnitEntry[][]; // groups[0] is Group 1, groups[1] is Group 2
}

export class ListBuilder {
    private static instance: ListBuilder;
    private state: ListState | null = null;
    private db: DatabaseAdapter;

    private constructor() {
        this.db = DatabaseAdapter.getInstance();
    }

    static getInstance(): ListBuilder {
        if (!ListBuilder.instance) {
            ListBuilder.instance = new ListBuilder();
        }
        return ListBuilder.instance;
    }

    hasList(): boolean {
        return this.state !== null;
    }

    createList(factionSlug: string, armyName: string, pointsLimit: number = 300) {
        if (!this.db.metadata) throw new Error("Database not initialized");

        const faction = this.db.factionRegistry?.getAllFactions().find(f => f.slug === factionSlug);
        if (!faction) throw new Error(`Faction '${factionSlug}' not found.`);

        this.state = {
            factionSlug: faction.slug,
            factionId: faction.id,
            armyName,
            pointsLimit,
            groups: [[]] // Start with group 1
        };

        return this.getStatus();
    }

    reset() {
        this.state = null;
    }

    addUnit(unitSlug: string, groupNumber: number, optionId?: number, _profileId?: number) {
        if (!this.state) throw new Error("No active list. Use create_list first.");

        // Find UInit
        const unit = this.db.getUnitBySlug(unitSlug) || this.db.getUnitBySlug(unitSlug.toLowerCase().replace(/ /g, '-'));
        if (!unit) throw new Error(`Unit '${unitSlug}' not found.`);

        // Find Option
        let option;
        let profileGroup;

        if (optionId) {
            // Find specific option
            for (const pg of unit.raw.profileGroups) {
                const opt = pg.options.find(o => o.id === optionId);
                if (opt) {
                    option = opt;
                    profileGroup = pg;
                    break;
                }
            }
        } else {
            // Default to first option of first profile
            profileGroup = unit.raw.profileGroups[0];
            option = profileGroup?.options[0];
        }

        if (!option || !profileGroup) throw new Error("Valid profile/option not found for unit.");

        const entry: UnitEntry = {
            unitId: unit.id,
            unitName: unit.name, // or option name?
            profileGroupId: profileGroup.id,
            optionId: option.id,
            points: option.points,
            swc: typeof option.swc === 'string' ? parseFloat(option.swc) : (option.swc || 0)
        };

        // Group management
        // Adjust array size if needed (e.g. adding to group 2 when only 1 exists)
        if (groupNumber < 1) throw new Error("Group number must be >= 1");

        // Ensure groups array is long enough
        while (this.state.groups.length < groupNumber) {
            this.state.groups.push([]);
        }

        const groupIndex = groupNumber - 1;
        if (this.state.groups[groupIndex].length >= 10) {
            throw new Error(`Combat Group ${groupNumber} is full (max 10 units).`);
        }

        this.state.groups[groupIndex].push(entry);
        return this.getStatus();
    }

    removeUnit(groupNumber: number, slotIndex: number) {
        if (!this.state) throw new Error("No active list.");

        const groupIndex = groupNumber - 1;
        if (groupIndex < 0 || groupIndex >= this.state.groups.length) throw new Error("Invalid group number.");

        if (slotIndex < 0 || slotIndex >= this.state.groups[groupIndex].length) throw new Error("Invalid slot index.");

        this.state.groups[groupIndex].splice(slotIndex, 1);

        // Clean up empty trailing groups? Maybe not necessary.
        return this.getStatus();
    }

    getStatus() {
        if (!this.state) return { status: "No active list" };

        let totalPoints = 0;
        let totalSwc = 0;
        let totalModels = 0;

        const groups = this.state.groups.map((g, i) => {
            const groupPoints = g.reduce((sum, u) => sum + u.points, 0);
            const groupSwc = g.reduce((sum, u) => sum + u.swc, 0);
            totalPoints += groupPoints;
            totalSwc += groupSwc;
            totalModels += g.length;

            return {
                group: i + 1,
                memberCount: g.length,
                points: groupPoints,
                swc: groupSwc,
                members: g.map((u, idx) => `[${idx}] ${u.unitName} (${u.points} pts, ${u.swc} SWC)`)
            };
        });

        return {
            armyName: this.state.armyName,
            faction: this.state.factionSlug,
            points: { current: totalPoints, max: this.state.pointsLimit },
            swc: { current: totalSwc, max: this.state.pointsLimit / 50 },
            modelCount: totalModels,
            groups
        };
    }

    generateCode(): string {
        if (!this.state) throw new Error("No active list.");

        const encodableList = {
            factionId: this.state.factionId,
            name: this.state.armyName,
            pointsLimit: this.state.pointsLimit,
            groups: this.state.groups.map(g => ({
                units: g.map(u => {
                    // Need to reconstruct a Unit object helper or mock it?
                    // encodeArmyList takes "unit: Unit".
                    // But getUnitId callback uses it.
                    // We can pass a minimal object if rewrite encodeArmyList?
                    // Or retrieve real unit.
                    const realUnit = this.db.getUnitById(u.unitId);
                    if (!realUnit) throw new Error(`Unit ID ${u.unitId} not found in DB`);
                    return {
                        unit: realUnit,
                        profileGroupId: u.profileGroupId,
                        optionId: u.optionId
                    };
                })
            }))
        };

        return encodeArmyList(
            encodableList,
            this.state.factionSlug,
            (u) => u.id // getUnitId helper
        );
    }
}
