import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { useContextMenuStore as useContextMenu } from '../../stores/useContextMenuStore';
import { getUnitDetails, type ListUnit } from '@shared/listTypes';
import { Eye, Trash2, GripVertical, Link } from 'lucide-react';
import { OrderIcon } from '../shared/OrderIcon';
import { getProfileOrders } from '../../utils/orderUtils';
import type { Unit } from '@shared/types';
import { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS } from '../../utils/classifications';
import styles from './ListDashboard.module.css';

export function DraggableUnitRow({
    listUnit,
    groupIndex,
    onViewUnit,
    onRemove,
}: {
    listUnit: ListUnit;
    groupIndex: number;
    onViewUnit: (unit: Unit, profileGroupId?: number) => void;
    onRemove: () => void;
}) {
    const { showMenu } = useContextMenu();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: listUnit.id,
        data: { type: 'unit', groupIndex, listUnit },
        disabled: listUnit.isPeripheral,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const profileGroup = listUnit.unit.raw.profileGroups.find(g => g.id === listUnit.profileGroupId);
    const { profile, option } = getUnitDetails(listUnit.unit, listUnit.profileGroupId, listUnit.profileId, listUnit.optionId);
    const orders = getProfileOrders(profile, option);

    const weapons = option?.weapons?.map(w => w.name).join(', ') || '—';
    const equipment = option?.equipment?.map(e => e.name).join(', ') || '';

    const optionModsAndSkills = (option?.skills || []).map(s =>
        s.displayName || s.name
    );
    let displayName = profileGroup?.isc || listUnit.unit.isc;
    if (optionModsAndSkills.length > 0) {
        displayName = `${displayName} (${optionModsAndSkills.join(', ')})`;
    }

    if (listUnit.isPeripheral) {
        return (
            <div
                className={clsx(styles.unitRow, 'cursor-pointer')}
                style={{ paddingLeft: '2.5rem', background: '#0a1020', borderLeft: '2px solid rgba(59, 130, 246, 0.3)' }}
                onClick={() => onViewUnit(listUnit.unit, listUnit.profileGroupId)}
            >
                <div className={clsx(styles.colDrag, 'flex items-center justify-center')} style={{ width: 30 }}>
                    <Link size={10} className="text-blue-500/40" />
                </div>
                <div className={clsx(styles.colOrders, 'flex items-center justify-center')}>
                    {orders.map((o, i) => <OrderIcon key={i} type={o} size={14} className={`opacity-60 ${i > 0 ? "-ml-1.5" : ""}`} />)}
                </div>
                <div className={clsx(styles.unitName, styles.colName)}>
                    <div className="flex items-center gap-1.5">
                        <span
                            className="text-[9px] font-bold px-1 py-0.5 rounded leading-none flex-shrink-0"
                            style={{ color: CLASSIFICATION_COLORS[5], background: `${CLASSIFICATION_COLORS[5]}15` }}
                        >
                            REM
                        </span>
                        <span className={styles.name} style={{ color: '#8b9ab5', fontStyle: 'italic', fontSize: '0.8rem' }}>{displayName}</span>
                    </div>
                </div>
                <div className={clsx(styles.unitWeapons, styles.colWeapons)}>
                    <span className={styles.weapons} style={{ color: '#64748b' }}>{weapons}</span>
                    {equipment && <span className={styles.equipment}>{equipment}</span>}
                </div>
                <div className={clsx(styles.unitSwc, styles.colSwc)} style={{ color: '#475569' }}>{option?.swc || 0}</div>
                <div className={clsx(styles.unitPts, styles.colPts)} style={{ color: '#475569' }}>{option?.points || 0}</div>
                <div className={clsx(styles.unitActions, styles.colActions)} />
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={clsx(styles.unitRow, isDragging && styles.dragging, 'cursor-pointer active:cursor-grabbing')}
            onClick={() => onViewUnit(listUnit.unit, listUnit.profileGroupId)}
            onContextMenu={(e) => {
                e.preventDefault();
                showMenu(e.clientX, e.clientY, [
                    { label: 'View Attributes & Rules', action: () => onViewUnit(listUnit.unit), icon: <Eye size={14} /> },
                    { divider: true, action: () => { } },
                    { label: 'Remove Unit', action: onRemove, icon: <Trash2 size={14} />, destructive: true }
                ]);
            }}
        >
            <div className={clsx(styles.dragHandle, styles.colDrag, 'flex items-center justify-center')}>
                <div className="text-gray-400 p-1">
                    <GripVertical size={14} />
                </div>
            </div>

            <div className={clsx(styles.colOrders, 'flex items-center justify-center')}>
                {orders.map((o, i) => <OrderIcon key={i} type={o} size={16} className={i > 0 ? "-ml-1.5" : ""} />)}
            </div>
            <div className={clsx(styles.unitName, styles.colName)}>
                <div className="flex items-center gap-1.5">
                    {profile?.unitType != null && CLASSIFICATION_LABELS[profile.unitType] && (
                        <span
                            className="text-[9px] font-bold px-1 py-0.5 rounded leading-none flex-shrink-0"
                            style={{
                                color: CLASSIFICATION_COLORS[profile.unitType],
                                background: `${CLASSIFICATION_COLORS[profile.unitType]}15`
                            }}
                        >
                            {CLASSIFICATION_LABELS[profile.unitType]}
                        </span>
                    )}
                    <span className={styles.name}>{displayName}</span>
                </div>
            </div>
            <div className={clsx(styles.unitWeapons, styles.colWeapons)}>
                <span className={styles.weapons}>{weapons}</span>
                {equipment && <span className={styles.equipment}>{equipment}</span>}
            </div>
            <div className={clsx(styles.unitSwc, styles.colSwc)}>{option?.swc || 0}</div>
            <div className={clsx(styles.unitPts, styles.colPts)}>{option?.points || 0}</div>
            <div className={clsx(styles.unitActions, styles.colActions)}>
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Remove"
                    className={styles.delete}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}
