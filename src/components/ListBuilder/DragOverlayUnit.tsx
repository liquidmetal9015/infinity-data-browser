import { useDatabase } from '../../hooks/useDatabase';
import { getUnitDetails, type ListUnit } from '@shared/listTypes';
import { GripVertical } from 'lucide-react';

export function DragOverlayUnit({ listUnit }: { listUnit: ListUnit }) {
    const profileGroup = listUnit.unit.raw.profileGroups.find(g => g.id === listUnit.profileGroupId);
    const { option } = getUnitDetails(listUnit.unit, listUnit.profileGroupId, listUnit.profileId, listUnit.optionId);

    const db = useDatabase();

    const optionModsAndSkills = [
        ...(option?.skills || []).map(s => {
            const mods = s.extra?.length ? ` (${s.extra.map((eid: number) => db.getExtraName(eid) || eid).join(', ')})` : '';
            return `${db.skillMap.get(s.id) || `Skill ${s.id}`}${mods}`;
        })
    ];
    let displayName = profileGroup?.isco || listUnit.unit.isc;
    if (optionModsAndSkills.length > 0) {
        displayName = `${displayName} (${optionModsAndSkills.join(', ')})`;
    }

    return (
        <div className="drag-overlay-unit">
            <GripVertical size={14} />
            <span className="name">{displayName}</span>
            <span className="pts">{option?.points || 0} pts</span>
        </div>
    );
}
