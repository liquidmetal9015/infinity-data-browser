import { Plus, Trash2, Info, Users } from 'lucide-react';
import type { CombatGroup } from '../../types/list';
import type { Unit } from '@shared/types';
import type { IDatabase } from '../../services/Database';

interface CombatGroupViewProps {
    group: CombatGroup;
    groupIndex: number;
    canRemove: boolean;
    onAddUnit: () => void;
    onRemoveUnit: (unitId: string) => void;
    onRemoveGroup: () => void;
    onViewUnit: (unit: Unit) => void;
    db: IDatabase;
}

export function CombatGroupView({
    group,
    groupIndex: _groupIndex,
    canRemove,
    onAddUnit,
    onRemoveUnit,
    onRemoveGroup,
    onViewUnit,
    db,
}: CombatGroupViewProps) {
    const MAX_UNITS = 10;
    const unitCount = group.units.length;
    const isFull = unitCount >= MAX_UNITS;

    return (
        <div className="combat-group">
            <div className="group-header">
                <div className="group-title">
                    <Users size={18} />
                    <h3>{group.name}</h3>
                    <span className="unit-count">{unitCount} / {MAX_UNITS}</span>
                </div>
                {canRemove && (
                    <button
                        className="remove-group-btn"
                        onClick={onRemoveGroup}
                        title="Remove Combat Group"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            <div className="unit-list">
                {group.units.map((listUnit) => {
                    const profileGroup = listUnit.unit.raw.profileGroups.find(
                        pg => pg.id === listUnit.profileGroupId
                    );
                    const option = profileGroup?.options.find(o => o.id === listUnit.optionId);

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

                    // Build weapons string
                    const weapons = option?.weapons?.map(w => db.weaponMap.get(w.id) || 'Unknown').join(', ') || '';

                    return (
                        <div key={listUnit.id} className="unit-row">
                            <div className="unit-info">
                                <span className="unit-name">{displayName}</span>
                                <span className="unit-weapons">{weapons}</span>
                            </div>
                            <div className="unit-cost">
                                <span className="points">{listUnit.points} pts</span>
                                <span className="swc">{listUnit.swc} SWC</span>
                            </div>
                            <div className="unit-actions">
                                <button
                                    className="action-btn info"
                                    onClick={() => onViewUnit(listUnit.unit)}
                                    title="View Unit"
                                >
                                    <Info size={14} />
                                </button>
                                <button
                                    className="action-btn remove"
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
                    <div key={`empty-${i}`} className="unit-row empty">
                        <span className="empty-slot">Empty Slot</span>
                    </div>
                ))}
            </div>

            <button
                className={`add-unit-btn ${isFull ? 'disabled' : ''}`}
                onClick={onAddUnit}
                disabled={isFull}
            >
                <Plus size={16} />
                Add Unit
            </button>

            <style>{`
                .combat-group {
                    background: var(--surface-elevated);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .group-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    background: var(--surface-base);
                    border-bottom: 1px solid var(--border-subtle);
                }
                .group-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .group-title h3 {
                    margin: 0;
                    font-size: 1rem;
                    color: var(--text-primary);
                }
                .unit-count {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    background: var(--surface-elevated);
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                }
                .remove-group-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.25rem;
                    border-radius: 4px;
                    transition: all 0.2s ease;
                }
                .remove-group-btn:hover {
                    color: var(--color-error);
                    background: rgba(var(--color-error-rgb), 0.1);
                }
                .unit-list {
                    padding: 0.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    min-height: 100px;
                }
                .unit-row {
                    display: flex;
                    align-items: center;
                    padding: 0.5rem 0.75rem;
                    background: var(--surface-base);
                    border-radius: 4px;
                    border: 1px solid var(--border-subtle);
                }
                .unit-row.empty {
                    opacity: 0.3;
                    border-style: dashed;
                }
                .empty-slot {
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                }
                .unit-info {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    min-width: 0;
                }
                .unit-name {
                    font-weight: 500;
                    color: var(--text-primary);
                    white-space: nowrap;
                }
                .profile-name {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                }
                .unit-weapons {
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .unit-cost {
                    display: flex;
                    gap: 0.75rem;
                    margin-left: auto;
                    padding-left: 1rem;
                }
                .points {
                    font-weight: 500;
                    color: var(--color-primary);
                }
                .swc {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                }
                .unit-actions {
                    display: flex;
                    gap: 0.25rem;
                    margin-left: 0.75rem;
                }
                .action-btn {
                    background: transparent;
                    border: none;
                    padding: 0.25rem;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .action-btn.info {
                    color: var(--text-secondary);
                }
                .action-btn.info:hover {
                    color: var(--color-primary);
                    background: rgba(var(--color-primary-rgb), 0.1);
                }
                .action-btn.remove {
                    color: var(--text-secondary);
                }
                .action-btn.remove:hover {
                    color: var(--color-error);
                    background: rgba(var(--color-error-rgb), 0.1);
                }
                .add-unit-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.75rem;
                    background: var(--surface-base);
                    border: none;
                    color: var(--color-primary);
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                .add-unit-btn:hover:not(.disabled) {
                    background: rgba(var(--color-primary-rgb), 0.1);
                }
                .add-unit-btn.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    color: var(--text-secondary);
                }
            `}</style>
        </div>
    );
}
