import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useContextMenuStore as useContextMenu } from '../../stores/useContextMenuStore';
import { getUnitDetails, type ListUnit } from '@shared/listTypes';
import { Eye, Trash2, GripVertical, Link } from 'lucide-react';
import { OrderIcon } from '../shared/OrderIcon';
import { getProfileOrders } from '../../utils/orderUtils';
import type { Unit } from '@shared/types';
import type { useDatabase } from '../../hooks/useDatabase';
import { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS } from '../../utils/classifications';

export function DraggableUnitRow({
    listUnit,
    groupIndex,
    onViewUnit,
    onRemove,
    db
}: {
    listUnit: ListUnit;
    groupIndex: number;
    onViewUnit: (unit: Unit) => void;
    onRemove: () => void;
    db: ReturnType<typeof useDatabase>;
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

    const weapons = option?.weapons?.map(w => db.weaponMap.get(w.id) || 'Unknown').join(', ') || '—';
    const equipment = option?.equip?.map(e => db.equipmentMap.get(e.id) || 'Unknown').join(', ') || '';

    const optionModsAndSkills = [
        ...(option?.skills || []).map(s => {
            const mods = s.extra?.length ? ` (${s.extra.map((eid: number) => db.getExtraName(eid) || eid).join(', ')})` : '';
            return `${db.skillMap.get(s.id) || `Skill ${s.id}`}${mods}`;
        })
    ];
    let displayName = profileGroup?.isco || profileGroup?.isc || listUnit.unit.isc;
    if (optionModsAndSkills.length > 0) {
        displayName = `${displayName} (${optionModsAndSkills.join(', ')})`;
    }

    // Peripheral row - simplified, indented, non-draggable
    if (listUnit.isPeripheral) {
        return (
            <div
                className="unit-row"
                style={{ paddingLeft: '2.5rem', background: '#0a1020', borderLeft: '2px solid rgba(59, 130, 246, 0.3)' }}
            >
                <div className="col-drag flex items-center justify-center" style={{ width: 30 }}>
                    <Link size={10} className="text-blue-500/40" />
                </div>
                <div className="unit-orders col-orders">
                    <div className="flex items-center justify-center">
                        {orders.map((o, i) => <OrderIcon key={i} type={o} size={14} className={`opacity-60 ${i > 0 ? "-ml-1.5" : ""}`} />)}
                    </div>
                </div>
                <div className="unit-name col-name">
                    <div className="flex items-center gap-1.5">
                        <span
                            className="text-[9px] font-bold px-1 py-0.5 rounded leading-none flex-shrink-0"
                            style={{ color: CLASSIFICATION_COLORS[5], background: `${CLASSIFICATION_COLORS[5]}15` }}
                        >
                            REM
                        </span>
                        <span className="name" style={{ color: '#8b9ab5', fontStyle: 'italic', fontSize: '0.8rem' }} title={displayName}>{displayName}</span>
                    </div>
                </div>
                <div className="unit-weapons col-weapons">
                    <span className="weapons" style={{ color: '#64748b' }} title={weapons}>{weapons}</span>
                    {equipment && <span className="equipment" title={equipment}>{equipment}</span>}
                </div>
                <div className="unit-swc col-swc" style={{ color: '#475569' }}>{option?.swc || 0}</div>
                <div className="unit-pts col-pts" style={{ color: '#475569' }}>{option?.points || 0}</div>
                <div className="unit-actions col-actions">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewUnit(listUnit.unit); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        title="View unit"
                    >
                        <Eye size={14} />
                    </button>
                </div>
            </div>
        );
    }

    // Normal unit row
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`unit-row ${isDragging ? 'dragging' : ''} cursor-grab active:cursor-grabbing`}
            onContextMenu={(e) => {
                e.preventDefault();
                showMenu(e.clientX, e.clientY, [
                    { label: 'View Attributes & Rules', action: () => onViewUnit(listUnit.unit), icon: <Eye size={14} /> },
                    { divider: true, action: () => { } },
                    { label: 'Remove Unit', action: onRemove, icon: <Trash2 size={14} />, destructive: true }
                ]);
            }}
        >
            <div className="drag-handle col-drag flex items-center justify-center">
                <div className="text-gray-400 p-1">
                    <GripVertical size={14} />
                </div>
            </div>

            <div className="unit-orders col-orders">
                <div className="flex items-center justify-center">
                    {orders.map((o, i) => <OrderIcon key={i} type={o} size={16} className={i > 0 ? "-ml-1.5" : ""} />)}
                </div>
            </div>
            <div className="unit-name col-name">
                <div className="flex items-center gap-1.5">
                    {profile?.type != null && CLASSIFICATION_LABELS[profile.type] && (
                        <span
                            className="text-[9px] font-bold px-1 py-0.5 rounded leading-none flex-shrink-0"
                            style={{
                                color: CLASSIFICATION_COLORS[profile.type],
                                background: `${CLASSIFICATION_COLORS[profile.type]}15`
                            }}
                        >
                            {CLASSIFICATION_LABELS[profile.type]}
                        </span>
                    )}
                    <span className="name" title={displayName}>{displayName}</span>
                </div>
            </div>
            <div className="unit-weapons col-weapons">
                <span className="weapons" title={weapons}>{weapons}</span>
                {equipment && <span className="equipment" title={equipment}>{equipment}</span>}
            </div>
            <div className="unit-swc col-swc">{option?.swc || 0}</div>
            <div className="unit-pts col-pts">{option?.points || 0}</div>
            <div className="unit-actions col-actions">
                <button
                    onClick={(e) => { e.stopPropagation(); onViewUnit(listUnit.unit); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="View unit"
                >
                    <Eye size={14} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Remove"
                    className="delete"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}
