import { useQuery } from '@tanstack/react-query';
import type { ArmyList, ListUnit } from '@shared/listTypes';
import { getUnitDetails } from '@shared/listTypes';
import { listService } from '../../services/listService';

export function ListUnitsSummary({ listId, fallback }: { listId: string; fallback?: ArmyList }) {
    const { data, isLoading } = useQuery<ArmyList>({
        queryKey: ['list-detail', listId],
        queryFn: () => listService.getList(listId),
        enabled: !fallback,
        initialData: fallback,
        staleTime: 60_000,
    });

    const muted: React.CSSProperties = { fontSize: 'var(--text-sm)', color: 'var(--text-tertiary, #64748b)', fontStyle: 'italic' };
    if (isLoading && !data) return <div style={muted}>Loading units…</div>;
    if (!data) return <div style={muted}>(unable to load)</div>;

    const groups = (data.groups ?? []).filter(g => g.units.some(u => !u.isPeripheral));
    if (groups.length === 0) return <div style={muted}>(empty list)</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {groups.map((g, idx) => {
                const realUnits = g.units.filter(u => !u.isPeripheral);
                return (
                    <div key={g.id} style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        <span style={{ color: 'var(--text-tertiary, #64748b)', fontWeight: 'var(--font-semibold)', marginRight: '0.4rem', fontSize: 'var(--text-2xs)' }}>
                            G{idx + 1}
                        </span>
                        {realUnits.map((u, i) => {
                            const label = unitLabel(u);
                            return (
                                <span key={u.id}>
                                    {i > 0 && <span style={{ color: 'var(--border)', margin: '0 0.35rem' }}>·</span>}
                                    {label}
                                </span>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

function unitLabel(u: ListUnit): string {
    const isc = u.unit?.isc || u.unit?.name || '?';
    const { option } = getUnitDetails(u.unit, u.profileGroupId, u.profileId, u.optionId);
    const optName = option?.name?.trim();
    if (optName && optName !== isc && !isc.toLowerCase().includes(optName.toLowerCase())) {
        return `${isc} (${optName})`;
    }
    return isc;
}
