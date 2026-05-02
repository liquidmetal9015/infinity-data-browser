import { calculateF2F, type CombatantInput } from '@shared/dice-engine';
import { getFireteamBonuses } from '@shared/fireteams';
import type { ProcessedUnit, Profile, Loadout } from '@shared/game-model';
import { GameDataLoader } from '../gameData/loader.js';

const ROSTER_CAP = 30;
const LOADOUT_CAP = 5;

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown> | unknown;

interface ItemSummary {
    name: string;
    modifiers: string[];
}

export class ToolExecutor {
    private handlers: Record<string, ToolHandler>;

    constructor(private loader: GameDataLoader) {
        this.handlers = {
            search_units: input => this.searchUnits(input),
            get_unit_profile: input => this.getUnitProfile(input),
            get_faction_context: input => this.getFactionContext(input),
            validate_fireteam: input => this.validateFireteam(input),
            analyze_matchup: input => this.analyzeMatchup(input),
            analyze_classifieds: input => this.analyzeClassifieds(input),
        };
    }

    async execute(toolName: string, input: Record<string, unknown>): Promise<string> {
        const handler = this.handlers[toolName];
        if (!handler) return JSON.stringify({ error: `Unknown tool: ${toolName}` });
        try {
            await this.loader.ready();
            const result = await handler(input);
            return JSON.stringify(result);
        } catch (e) {
            return JSON.stringify({ error: (e as Error).message });
        }
    }

    // ---- handlers --------------------------------------------------------

    private searchUnits(input: Record<string, unknown>) {
        const query = asString(input.query)?.toLowerCase();
        const factionId = asInt(input.faction_id);
        const minPoints = asInt(input.min_points);
        const maxPoints = asInt(input.max_points);
        const limit = Math.min(asInt(input.limit) ?? 20, ROSTER_CAP);

        const pool = factionId != null
            ? this.loader.unitsByFaction.get(factionId) ?? []
            : this.loader.units;

        const matched = pool.filter(u => {
            if (query) {
                if (!u.name.toLowerCase().includes(query) && !u.isc.toLowerCase().includes(query)) {
                    return false;
                }
            }
            const [pmin, pmax] = u.pointsRange;
            if (minPoints != null && pmax < minPoints) return false;
            if (maxPoints != null && pmin > maxPoints) return false;
            return true;
        });

        matched.sort((a, b) => a.name.localeCompare(b.name));
        const sliced = matched.slice(0, limit);

        return {
            count: sliced.length,
            units: sliced.map(u => ({
                name: u.name,
                isc: u.isc,
                slug: u.slug,
                factions: u.factionIds.map(fid => this.loader.factionsById.get(fid)?.slug).filter(Boolean),
                points_min: u.pointsRange[0],
                points_max: u.pointsRange[1],
            })),
        };
    }

    private getUnitProfile(input: Record<string, unknown>) {
        const slug = asString(input.slug);
        if (!slug) return { error: 'slug is required' };

        const unit = this.loader.unitsBySlug.get(slug);
        if (!unit) return { error: `Unit '${slug}' not found` };

        const profiles: Profile[] = [];
        const loadouts: Loadout[] = [];
        for (const pg of unit.profileGroups) {
            for (const p of pg.profiles) profiles.push(p);
            for (const o of pg.options) loadouts.push(o);
        }

        return {
            name: unit.name,
            isc: unit.isc,
            slug: unit.slug,
            factions: factionSlugs(unit, this.loader),
            profiles: profiles.map(p => ({
                name: p.name,
                mov: `${p.move[0]}-${p.move[1]}`,
                cc: p.cc,
                bs: p.bs,
                ph: p.ph,
                wip: p.wip,
                arm: p.arm,
                bts: p.bts,
                wounds: p.w,
                silhouette: p.s,
                unit_type: p.unitType,
                skills: p.skills.map(toItemSummary),
                equipment: p.equipment.map(toItemSummary),
                weapons: p.weapons.map(toItemSummary),
            })),
            loadouts: loadouts.slice(0, LOADOUT_CAP).map(lo => ({
                name: lo.name,
                points: lo.points,
                swc: lo.swc,
                weapons: lo.weapons.map(toItemSummary),
                skills: lo.skills.map(toItemSummary),
                equipment: lo.equipment.map(toItemSummary),
            })),
        };
    }

    private getFactionContext(input: Record<string, unknown>) {
        const factionId = asInt(input.faction_id);
        if (factionId == null) return { error: 'faction_id is required' };
        const includeRoster = (input.include_roster ?? true) !== false;
        const includeFireteams = (input.include_fireteams ?? true) !== false;

        const faction = this.loader.factionsById.get(factionId);
        if (!faction) return { error: `Faction ${factionId} not found` };

        const out: Record<string, unknown> = {
            id: faction.id,
            name: faction.name,
            slug: faction.slug,
        };

        if (includeFireteams) {
            const chart = this.loader.fireteamCharts.get(factionId);
            if (chart) {
                out.fireteams = chart.teams.map(t => ({
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
            const roster = this.loader.unitsByFaction.get(factionId) ?? [];
            const sorted = [...roster].sort((a, b) => a.name.localeCompare(b.name));
            const truncated = sorted.length > ROSTER_CAP;
            out.roster = sorted.slice(0, ROSTER_CAP).map(u => ({
                name: u.name,
                isc: u.isc,
                slug: u.slug,
                points_min: u.pointsRange[0],
                points_max: u.pointsRange[1],
            }));
            out.roster_truncated = truncated;
        }

        return out;
    }

    private validateFireteam(input: Record<string, unknown>) {
        const factionId = asInt(input.faction_id);
        const teamName = asString(input.team_name);
        const memberNames = asStringArray(input.member_names);
        if (factionId == null || !teamName || memberNames.length === 0) {
            return { error: 'faction_id, team_name, and member_names are required' };
        }

        const chart = this.loader.fireteamCharts.get(factionId);
        if (!chart) return { error: `No fireteam chart found for faction ${factionId}` };

        const team = chart.teams.find(t => t.name?.toLowerCase() === teamName.toLowerCase());
        if (!team) {
            return {
                error: `Team '${teamName}' not found`,
                available_teams: chart.teams.map(t => t.name),
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

function toItemSummary(item: { name: string; modifiers: string[] }): ItemSummary {
    return { name: item.name, modifiers: item.modifiers };
}

function factionSlugs(unit: ProcessedUnit, loader: GameDataLoader): string[] {
    const out: string[] = [];
    for (const fid of unit.factionIds) {
        const slug = loader.factionsById.get(fid)?.slug;
        if (slug) out.push(slug);
    }
    return out;
}

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
