import type { SuperFaction, FactionInfo } from '../utils/factions';

interface FactionSelectorProps {
    value: number | null;
    onChange: (factionId: number) => void;
    groupedFactions: SuperFaction[];
    placeholder?: string;
    filterFn?: (faction: FactionInfo) => boolean;
    className?: string;
}

/**
 * Reusable grouped faction dropdown selector.
 * Displays factions grouped by super-faction (PanO, Yu Jing, etc.).
 */
export function FactionSelector({
    value,
    onChange,
    groupedFactions,
    placeholder = '-- Select Faction --',
    filterFn,
    className = ''
}: FactionSelectorProps) {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = Number(e.target.value);
        if (id) {
            onChange(id);
        }
    };

    return (
        <select
            value={value || ''}
            onChange={handleChange}
            className={`faction-select ${className}`}
        >
            <option value="">{placeholder}</option>
            {groupedFactions.map(group => {
                // Apply filter if provided
                const vanilla = group.vanilla && (!filterFn || filterFn(group.vanilla)) ? group.vanilla : null;
                const sectorials = filterFn
                    ? group.sectorials.filter(filterFn)
                    : group.sectorials;

                // Skip if nothing to show
                if (!vanilla && sectorials.length === 0) return null;

                return (
                    <optgroup key={group.id} label={group.name}>
                        {vanilla && (
                            <option value={vanilla.id}>{vanilla.name}</option>
                        )}
                        {sectorials.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </optgroup>
                );
            })}
        </select>
    );
}
