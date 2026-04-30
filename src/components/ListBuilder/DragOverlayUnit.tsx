import { getUnitDetails, type ListUnit } from '@shared/listTypes';
import { GripVertical } from 'lucide-react';
import styles from './ListDashboard.module.css';

export function DragOverlayUnit({ listUnit }: { listUnit: ListUnit }) {
    const profileGroup = listUnit.unit.raw.profileGroups.find(g => g.id === listUnit.profileGroupId);
    const { option } = getUnitDetails(listUnit.unit, listUnit.profileGroupId, listUnit.profileId, listUnit.optionId);

    const optionModsAndSkills = (option?.skills || []).map(s => s.displayName || s.name);
    let displayName = profileGroup?.isc || listUnit.unit.isc;
    if (optionModsAndSkills.length > 0) {
        displayName = `${displayName} (${optionModsAndSkills.join(', ')})`;
    }

    return (
        <div className={styles.dragOverlayUnit}>
            <GripVertical size={14} />
            <span className={styles.name}>{displayName}</span>
            <span className={styles.pts}>{option?.points || 0} pts</span>
        </div>
    );
}
