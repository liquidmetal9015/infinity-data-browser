import type { SuperFaction } from '../../types';
import { FactionSelector } from '../FactionSelector';

interface CompactFactionSelectorProps {
    groupedFactions: SuperFaction[];
    value: number | null;
    onChange: (factionId: number) => void;
    className?: string;
}

export function CompactFactionSelector({
    groupedFactions,
    value,
    onChange,
    className = ''
}: CompactFactionSelectorProps) {
    return (
        <FactionSelector
            groupedFactions={groupedFactions}
            value={value}
            onChange={onChange}
            className={className}
        />
    );
}
