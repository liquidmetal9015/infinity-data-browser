import { and, asc, eq, ilike, inArray, or, gte, lte, type SQL } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
    units,
    factions,
    unit_factions,
    profiles,
    loadouts,
    fireteam_charts,
} from '../../db/schema.js';
import { resolveItems } from '../../lib/items.js';
import { getCatalogs } from '../../lib/catalogs.js';
import { calculateF2F, type CombatantInput } from '@shared/dice-engine';
import { getFireteamBonuses } from '@shared/fireteams';
import type { Fireteam } from '@shared/types';
import { GameDataLoader } from '../gameData/loader.js';

const ROSTER_CAP = 30;
const LOADOUT_CAP = 5;

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

export class ToolExecutor {
    private handlers: Record<string, ToolHandler>;

    constructor(private loader: GameDataLoader) {
        this.handlers = {
            search_units: input => this.searchUnits(input),
            get_unit_profile: input => this.getUnitProfile(input),
            get_faction_context: input => this.getFactionContext(input),
            validate_fireteam: input => this.validateFireteam(input),
            analyze_matchup: async input => this.analyzeMatchup(input),
            analyze_classifieds: async input => this.analyzeClassifieds(input),
        };
    }

    async execute(toolName: string, input: Record<string, unknown>): Promise<string> {
        const handler = this.handlers[toolName];
        if (!handler) return JSON.stringify({ error: `Unknown tool: ${toolName}` });
        try {
            const result = await handler(input);
            return JSON.stringify(result);
        } catch (e) {
            return JSON.stringify({ error: (e as Error).message });
        }
    }

    // ---- handlers --------------------------------------------------------

    private async searchUnits(input: Record<string, unknown>) {
        const query = asString(input.query);
        const factionId = asInt(input.faction_id);
        const minPoints = asInt(input.min_points);
        const maxPoints = asInt(input.max_points);
        const limit = Math.min(asInt(input.limit) ?? 20, ROSTER_CAP);

        let unitIds: number[] | null = null;

        if (factionId != null) {
            const rows = await db
                .select({ unit_id: unit_factions.unit_id })
                .from(unit_factions)
                .where(eq(unit_factions.faction_id, factionId));
            unitIds = rows.map(r => r.unit_id);
            if (unitIds.length === 0) return { count: 0, units: [] };
        }

        if (minPoints != null || maxPoints != null) {
            const conds: SQL[] = [];
            if (minPoints != null) conds.push(gte(loadouts.points, minPoints));
            if (maxPoints != null) conds.push(lte(loadouts.points, maxPoints));
            const rows = await db
                .selectDistinct({ unit_id: loadouts.unit_id })
                .from(loadouts)
                .where(and(...conds));
            const ids = rows.map(r => r.unit_id);
            if (ids.length === 0) return { count: 0, units: [] };
            unitIds = unitIds ? unitIds.filter(id => ids.includes(id)) : ids;
            if (unitIds.length === 0) return { count: 0, units: [] };
        }

        const conditions: SQL[] = [];
        if (query) {
            const pattern = `%${query}%`;
            conditions.push(or(ilike(units.name, pattern), ilike(units.isc, pattern))!);
        }
        if (unitIds) conditions.push(inArray(units.id, unitIds));

        const baseRows = await db
            .selectDistinct({
                id: units.id,
                isc: units.isc,
                name: units.name,
                slug: units.slug,
            })
            .from(units)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(asc(units.name))
            .limit(limit);

        if (baseRows.length === 0) return { count: 0, units: [] };
        const ids = baseRows.map(u => u.id);

        const [factionRows, loadoutRows] = await Promise.all([
            db
                .select({ unit_id: unit_factions.unit_id, slug: factions.slug })
                .from(unit_factions)
                .innerJoin(factions, eq(factions.id, unit_factions.faction_id))
                .where(inArray(unit_factions.unit_id, ids)),
            db
                .select({ unit_id: loadouts.unit_id, points: loadouts.points })
                .from(loadouts)
                .where(inArray(loadouts.unit_id, ids)),
        ]);

        const factionsByUnit = new Map<number, string[]>();
        for (const r of factionRows) {
            const arr = factionsByUnit.get(r.unit_id) ?? [];
            arr.push(r.slug);
            factionsByUnit.set(r.unit_id, arr);
        }
        const ptsByUnit = new Map<number, number[]>();
        for (const r of loadoutRows) {
            const arr = ptsByUnit.get(r.unit_id) ?? [];
            arr.push(r.points);
            ptsByUnit.set(r.unit_id, arr);
        }

        return {
            count: baseRows.length,
            units: baseRows.map(u => {
                const pts = ptsByUnit.get(u.id) ?? [];
                return {
                    name: u.name,
                    isc: u.isc,
                    slug: u.slug,
                    factions: factionsByUnit.get(u.id) ?? [],
                    points_min: pts.length ? Math.min(...pts) : 0,
                    points_max: pts.length ? Math.max(...pts) : 0,
                };
            }),
        };
    }

    private async getUnitProfile(input: Record<string, unknown>) {
        const slug = asString(input.slug);
        if (!slug) return { error: 'slug is required' };

        const [unit] = await db.select().from(units).where(eq(units.slug, slug)).limit(1);
        if (!unit) return { error: `Unit '${slug}' not found` };

        const [factionRows, profileRows, loadoutRows, catalogs] = await Promise.all([
            db
                .select({ slug: factions.slug })
                .from(unit_factions)
                .innerJoin(factions, eq(factions.id, unit_factions.faction_id))
                .where(eq(unit_factions.unit_id, unit.id)),
            db.select().from(profiles).where(eq(profiles.unit_id, unit.id)),
            db.select().from(loadouts).where(eq(loadouts.unit_id, unit.id)),
            getCatalogs(),
        ]);

        const sortedProfiles = [...profileRows].sort(
            (a, b) => a.profile_group_id - b.profile_group_id || a.id - b.id,
        );
        const sortedLoadouts = [...loadoutRows]
            .sort((a, b) => a.profile_group_id - b.profile_group_id || a.option_id - b.option_id)
            .slice(0, LOADOUT_CAP);

        return {
            name: unit.name,
            isc: unit.isc,
            slug: unit.slug,
            factions: factionRows.map(f => f.slug),
            profiles: sortedProfiles.map(p => ({
                name: p.name,
                mov: `${p.mov_1}-${p.mov_2}`,
                cc: p.cc,
                bs: p.bs,
                ph: p.ph,
                wip: p.wip,
                arm: p.arm,
                bts: p.bts,
                wounds: p.wounds,
                silhouette: p.silhouette,
                unit_type: p.unit_type,
                skills: resolveItems(p.skills_json, catalogs.skills).map(i => ({
                    name: i.name,
                    modifiers: i.extra_display,
                })),
                equipment: resolveItems(p.equipment_json, catalogs.equipment).map(i => ({
                    name: i.name,
                    modifiers: i.extra_display,
                })),
                weapons: resolveItems(p.weapons_json, catalogs.weapons).map(i => ({
                    name: i.name,
                    modifiers: i.extra_display,
                })),
            })),
            loadouts: sortedLoadouts.map(lo => ({
                name: lo.name,
                points: lo.points,
                swc: lo.swc,
                weapons: resolveItems(lo.weapons_json, catalogs.weapons).map(i => ({
                    name: i.name,
                    modifiers: i.extra_display,
                })),
                skills: resolveItems(lo.skills_json, catalogs.skills).map(i => ({
                    name: i.name,
                    modifiers: i.extra_display,
                })),
                equipment: resolveItems(lo.equipment_json, catalogs.equipment).map(i => ({
                    name: i.name,
                    modifiers: i.extra_display,
                })),
            })),
        };
    }

    private async getFactionContext(input: Record<string, unknown>) {
        const factionId = asInt(input.faction_id);
        if (factionId == null) return { error: 'faction_id is required' };
        const includeRoster = (input.include_roster ?? true) !== false;
        const includeFireteams = (input.include_fireteams ?? true) !== false;

        const [faction] = await db.select().from(factions).where(eq(factions.id, factionId)).limit(1);
        if (!faction) return { error: `Faction ${factionId} not found` };

        const out: Record<string, unknown> = {
            id: faction.id,
            name: faction.name,
            slug: faction.slug,
        };

        if (includeFireteams) {
            const [chart] = await db
                .select()
                .from(fireteam_charts)
                .where(eq(fireteam_charts.faction_id, factionId))
                .limit(1);
            if (chart) {
                const teams = (chart.chart_json as { teams?: Fireteam[] })?.teams ?? [];
                out.fireteams = teams.map(t => ({
                    name: t.name,
                    type: t.type ?? [],
                    slots: (t.units ?? []).map(u => ({
                        name: u.name,
                        min: u.min ?? 0,
                        max: u.max ?? 1,
                    })),
                }));
            }
        }

        if (includeRoster) {
            const rosterIds = await db
                .select({ unit_id: unit_factions.unit_id })
                .from(unit_factions)
                .where(eq(unit_factions.faction_id, factionId));
            const ids = rosterIds.map(r => r.unit_id);
            if (ids.length > 0) {
                const baseRows = await db
                    .select({
                        id: units.id,
                        isc: units.isc,
                        name: units.name,
                        slug: units.slug,
                    })
                    .from(units)
                    .where(inArray(units.id, ids))
                    .orderBy(asc(units.name))
                    .limit(ROSTER_CAP);

                const ptsRows = await db
                    .select({ unit_id: loadouts.unit_id, points: loadouts.points })
                    .from(loadouts)
                    .where(inArray(loadouts.unit_id, baseRows.map(b => b.id)));
                const ptsByUnit = new Map<number, number[]>();
                for (const r of ptsRows) {
                    const arr = ptsByUnit.get(r.unit_id) ?? [];
                    arr.push(r.points);
                    ptsByUnit.set(r.unit_id, arr);
                }

                out.roster = baseRows.map(u => {
                    const pts = ptsByUnit.get(u.id) ?? [];
                    return {
                        name: u.name,
                        isc: u.isc,
                        slug: u.slug,
                        points_min: pts.length ? Math.min(...pts) : 0,
                        points_max: pts.length ? Math.max(...pts) : 0,
                    };
                });
                out.roster_truncated = baseRows.length === ROSTER_CAP;
            } else {
                out.roster = [];
                out.roster_truncated = false;
            }
        }

        return out;
    }

    private async validateFireteam(input: Record<string, unknown>) {
        const factionId = asInt(input.faction_id);
        const teamName = asString(input.team_name);
        const memberNames = asStringArray(input.member_names);
        if (factionId == null || !teamName || memberNames.length === 0) {
            return { error: 'faction_id, team_name, and member_names are required' };
        }

        const [chart] = await db
            .select()
            .from(fireteam_charts)
            .where(eq(fireteam_charts.faction_id, factionId))
            .limit(1);
        if (!chart) return { error: `No fireteam chart found for faction ${factionId}` };

        const teams: Fireteam[] = (chart.chart_json as { teams?: Fireteam[] })?.teams ?? [];
        const team = teams.find(t => t.name?.toLowerCase() === teamName.toLowerCase());
        if (!team) {
            return {
                error: `Team '${teamName}' not found`,
                available_teams: teams.map(t => t.name),
            };
        }

        const members = memberNames.map(n => ({ name: n }));
        const bonuses = getFireteamBonuses(team, members);
        const activeBonuses = bonuses.filter(b => b.isActive);

        return {
            team: teamName,
            members: memberNames,
            is_valid: activeBonuses.length > 0,
            bonuses: bonuses.map(b => ({
                level: b.level,
                description: b.description,
                active: b.isActive,
            })),
            active_level: activeBonuses.length
                ? Math.max(...activeBonuses.map(b => b.level))
                : 0,
        };
    }

    private analyzeMatchup(input: Record<string, unknown>) {
        const active: CombatantInput = {
            sv: asInt(input.active_sv) ?? 0,
            burst: asInt(input.active_burst) ?? 0,
            damage: asInt(input.active_damage) ?? 0,
            ammo: asString(input.active_ammo) ?? 'NORMAL',
            arm: asInt(input.active_arm) ?? 0,
            bts: 0,
        };
        const reactive: CombatantInput = {
            sv: asInt(input.reactive_sv) ?? 0,
            burst: asInt(input.reactive_burst) ?? 0,
            damage: asInt(input.reactive_damage) ?? 0,
            ammo: asString(input.reactive_ammo) ?? 'NORMAL',
            arm: asInt(input.target_arm) ?? 0,
            bts: 0,
        };
        const result = calculateF2F(active, reactive);

        return {
            active_wins_pct: result.activeWins,
            reactive_wins_pct: result.reactiveWins,
            draw_pct: result.draw,
            expected_wounds_on_reactive: result.expectedActiveWounds,
            expected_wounds_on_active: result.expectedReactiveWounds,
            wound_distribution_on_reactive: result.woundDistActive,
            wound_distribution_on_active: result.woundDistReactive,
            summary: `Active player wins ${result.activeWins}% of the time, dealing ${result.expectedActiveWounds.toFixed(2)} expected wounds. Reactive wins ${result.reactiveWins}%.`,
        };
    }

    private analyzeClassifieds(input: Record<string, unknown>) {
        const unitNames = asStringArray(input.unit_names);
        const classifieds = this.loader.classifieds;
        if (!classifieds || classifieds.length === 0) {
            return { error: 'Classifieds data not available' };
        }

        const lowerNames = unitNames.map(n => n.toLowerCase());

        const completable: Array<Record<string, unknown>> = [];
        const notCompletable: Array<Record<string, unknown>> = [];

        for (const obj of classifieds) {
            const designated = (obj.designatedTroopers ?? []).map(t => t.toLowerCase());
            if (designated.length === 0) {
                completable.push({ name: obj.name, category: obj.category ?? '' });
                continue;
            }

            const canComplete = designated.some(d =>
                lowerNames.some(n => d.includes(n) || n.includes(d)),
            );
            const entry = {
                name: obj.name,
                category: obj.category ?? '',
                requires: obj.designatedTroopers ?? [],
            };
            if (canComplete) completable.push(entry);
            else notCompletable.push(entry);
        }

        const total = classifieds.length;
        const pct = total ? Math.round((completable.length / total) * 100) : 0;

        return {
            coverage_pct: pct,
            completable_count: completable.length,
            total_count: total,
            completable,
            not_completable: notCompletable,
            summary: `Your list can complete ${completable.length}/${total} classifieds (${pct}%).`,
        };
    }
}

// ---- helpers ------------------------------------------------------------

function asString(v: unknown): string | undefined {
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function asInt(v: unknown): number | null {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string') {
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}
function asStringArray(v: unknown): string[] {
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
