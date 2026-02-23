import { Shield } from 'lucide-react';
import type { SuperFaction } from '../../types';
import './CompactFactionSelector.css';

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
        <div className={`compact-faction-selector ${className} `}>
            <div className="faction-icon">
                <Shield size={20} />
            </div>
            <select
                value={value || ''}
                onChange={(e) => {
                    const id = Number(e.target.value);
                    if (id) {
                        onChange(id);
                    }
                }}
                className="faction-select"
            >
                <option value="">-- Select Faction --</option>
                {groupedFactions.map(group => (
                    <optgroup key={group.id} label={group.name}>
                        {group.vanilla && (
                            <option value={group.vanilla.id}>{group.vanilla.name}</option>
                        )}
                        {group.sectorials.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.name} {s.discontinued ? '(Legacy)' : ''}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
        </div>
    );
}
