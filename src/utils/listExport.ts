import type { ArmyList } from '@shared/listTypes';
import type { ListSummary } from '../services/listService';

export interface ListExportItem {
    armyList: ArmyList;
    summary: ListSummary;
    factionName: string;
    armyCode: string;
}

export function fmtSwc(v: number): string {
    return v % 1 === 0 ? String(v) : v.toFixed(1);
}

export function fmtStars(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function fmtDate(ts: number | string): string {
    return new Date(typeof ts === 'number' ? ts : ts).toISOString().slice(0, 10);
}

export function generateMarkdownExport(items: ListExportItem[]): string {
    const sections = items.map(({ armyList, summary, factionName, armyCode }) => {
        const url = `https://infinitytheuniverse.com/army/list/${armyCode}`;
        const lines: string[] = [];

        lines.push(`# ${armyList.name}`);
        lines.push('');
        lines.push(`**Faction:** ${factionName}  `);
        lines.push(`**Points:** ${summary.points} / ${armyList.pointsLimit} · **SWC:** ${fmtSwc(summary.swc)} / ${fmtSwc(armyList.swcLimit)}  `);
        if (armyList.rating) lines.push(`**Rating:** ${fmtStars(armyList.rating)}  `);
        if (armyList.tags?.length) lines.push(`**Tags:** ${armyList.tags.join(', ')}  `);
        lines.push(`**Created:** ${fmtDate(armyList.createdAt)} · **Updated:** ${fmtDate(armyList.updatedAt)}`);

        if (armyList.notes?.trim()) {
            lines.push('');
            lines.push(`> ${armyList.notes.trim().replace(/\n/g, '\n> ')}`);
        }

        lines.push('');
        lines.push(`[Open in Infinity Army →](${url})`);
        lines.push('');
        lines.push('```');
        lines.push(armyCode);
        lines.push('```');

        for (const group of armyList.groups) {
            if (group.units.length === 0) continue;
            lines.push('');
            lines.push(`### ${group.name || 'Combat Group'}`);
            lines.push('');
            lines.push('| Unit | Loadout | Pts | SWC |');
            lines.push('|------|---------|----:|----:|');
            for (const lu of group.units) {
                const profileGroup = lu.unit.raw.profileGroups.find(pg => pg.id === lu.profileGroupId);
                const option = profileGroup?.options.find(o => o.id === lu.optionId);
                const unitLabel = lu.isPeripheral
                    ? `↳ ${profileGroup?.isc ?? lu.unit.name}`
                    : (profileGroup?.isc ?? lu.unit.name);
                lines.push(`| ${unitLabel} | ${option?.name ?? '—'} | ${lu.points} | ${fmtSwc(lu.swc)} |`);
            }
            const gPts = group.units.filter(u => !u.isPeripheral).reduce((s, u) => s + u.points, 0);
            const gSwc = group.units.filter(u => !u.isPeripheral).reduce((s, u) => s + u.swc, 0);
            lines.push('');
            lines.push(`*${gPts} pts / ${fmtSwc(gSwc)} SWC*`);
        }

        lines.push('');
        lines.push(`**Total: ${summary.points} pts / ${fmtSwc(summary.swc)} SWC** (${summary.unit_count} units)`);

        return lines.join('\n');
    });

    return sections.join('\n\n---\n\n');
}

export function serializeListForJson(
    armyList: ArmyList,
    summary: ListSummary,
    factionName: string,
    armyCode: string,
) {
    return {
        id: armyList.id,
        name: armyList.name,
        notes: armyList.notes ?? null,
        tags: armyList.tags,
        rating: armyList.rating ?? null,
        factionId: armyList.factionId,
        factionName,
        pointsLimit: armyList.pointsLimit,
        swcLimit: armyList.swcLimit,
        points: summary.points,
        swc: summary.swc,
        unitCount: summary.unit_count,
        createdAt: armyList.createdAt,
        updatedAt: armyList.updatedAt,
        armyCode,
        groups: armyList.groups.map(g => ({
            id: g.id,
            name: g.name,
            fireteams: g.fireteams ?? [],
            units: g.units.map(lu => ({
                id: lu.id,
                unitId: lu.unit.id,
                unitIdArmy: lu.unit.idArmy ?? null,
                unitName: lu.unit.name,
                profileGroupId: lu.profileGroupId,
                profileId: lu.profileId,
                optionId: lu.optionId,
                points: lu.points,
                swc: lu.swc,
                isPeripheral: lu.isPeripheral ?? false,
                parentId: lu.parentId ?? null,
                fireteamId: lu.fireteamId ?? null,
                fireteamColor: lu.fireteamColor ?? null,
                fireteamNotes: lu.fireteamNotes ?? null,
            })),
        })),
    };
}
