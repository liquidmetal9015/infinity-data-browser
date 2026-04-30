import { clsx } from 'clsx';
import { Plus, Trash2, Info, Users } from 'lucide-react';
import type { CombatGroup } from '@shared/listTypes';
import type { Unit } from '@shared/types';
import styles from './CombatGroupView.module.css';

interface CombatGroupViewProps {
    group: CombatGroup;
    groupIndex: number;
    canRemove: boolean;
    onAddUnit: () => void;
    onRemoveUnit: (unitId: string) => void;
    onRemoveGroup: () => void;
    onViewUnit: (unit: Unit) => void;
}

export function CombatGroupView({
    group,
    groupIndex: _groupIndex,
    canRemove,
    onAddUnit,
    onRemoveUnit,
    onRemoveGroup,
    onViewUnit,
}: CombatGroupViewProps) {
    const MAX_UNITS = 10;
    const unitCount = group.units.length;
    const isFull = unitCount >= MAX_UNITS;

    return (
        <div className={styles.combatGroup}>
            <div className={styles.groupHeader}>
                <div className={styles.groupTitle}>
                    <Users size={18} />
                    <h3>{group.name}</h3>
                    <span className={styles.unitCount}>{unitCount} / {MAX_UNITS}</span>
                </div>
                {canRemove && (
                    <button
                        className={styles.removeGroupBtn}
                        onClick={onRemoveGroup}
                        title="Remove Combat Group"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            <div className={styles.unitList}>
                {group.units.map((listUnit) => {
                    const profileGroup = listUnit.unit.raw.profileGroups.find(
                        pg => pg.id === listUnit.profileGroupId
                    );
                    const option = profileGroup?.options.find(o => o.id === listUnit.optionId);

                    const optionModsAndSkills = (option?.skills || []).map(s => s.displayName || s.name);
                    let displayName = profileGroup?.isc || listUnit.unit.isc;
                    if (optionModsAndSkills.length > 0) {
                        displayName = `${displayName} (${optionModsAndSkills.join(', ')})`;
                    }

                    const weapons = option?.weapons?.map(w => w.name).join(', ') || '';

                    return (
                        <div key={listUnit.id} className={styles.unitRow}>
                            <div className={styles.unitInfo}>
                                <span className={styles.unitName}>{displayName}</span>
                                <span className={styles.unitWeapons}>{weapons}</span>
                            </div>
                            <div className={styles.unitCost}>
                                <span className={styles.points}>{listUnit.points} pts</span>
                                <span className={styles.swc}>{listUnit.swc} SWC</span>
                            </div>
                            <div className={styles.unitActions}>
                                <button
                                    className={clsx(styles.actionBtn, styles.info)}
                                    onClick={() => onViewUnit(listUnit.unit)}
                                    title="View Unit"
                                >
                                    <Info size={14} />
                                </button>
                                <button
                                    className={clsx(styles.actionBtn, styles.remove)}
                                    onClick={() => onRemoveUnit(listUnit.id)}
                                    title="Remove Unit"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {/* Empty slots visualization */}
                {Array.from({ length: Math.max(0, MAX_UNITS - unitCount - 1) }).map((_, i) => (
                    <div key={`empty-${i}`} className={clsx(styles.unitRow, styles.empty)}>
                        <span className={styles.emptySlot}>Empty Slot</span>
                    </div>
                ))}
            </div>

            <button
                className={clsx(styles.addUnitBtn, isFull && styles.disabled)}
                onClick={onAddUnit}
                disabled={isFull}
            >
                <Plus size={16} />
                Add Unit
            </button>
        </div>
    );
}
