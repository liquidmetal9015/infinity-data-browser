import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { useListBuilderUIStore } from '../stores/useListBuilderUIStore';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

export function UnitLink({ name, className = '' }: { name: string, className?: string }) {
    const db = useDatabase();
    const navigate = useNavigate();
    const selectUnitForDetail = useListBuilderUIStore(s => s.selectUnitForDetail);
    const openWindow = useWorkspaceStore(s => s.openWindow);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const unit = db.units.find(u => u.name === name);
        if (unit) {
            selectUnitForDetail(unit);
            openWindow('UNIT_DETAIL');
            navigate('/');
        } else {
            console.warn(`Unit not found: ${name}`);
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`cursor-pointer transition-colors ${className}`}
        >
            {name}
        </button>
    );
}
