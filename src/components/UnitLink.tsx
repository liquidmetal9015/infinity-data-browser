import { useDatabase } from '../context/DatabaseContext';
import { useModal } from '../context/ModalContext';

export function UnitLink({ name, className = '' }: { name: string, className?: string }) {
    const db = useDatabase();
    const { openUnitModal } = useModal();

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const unit = db.units.find(u => u.name === name);
        if (unit) {
            openUnitModal(unit);
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
