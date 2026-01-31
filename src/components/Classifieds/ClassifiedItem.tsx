import React from 'react';
import type { ClassifiedObjective, ClassifiedMatch } from '../../../shared/classifieds';

interface ClassifiedItemProps {
    objective: ClassifiedObjective;
    match?: ClassifiedMatch;
    isActive: boolean; // Hovered or selected
    isSubdued: boolean; // If another item is active and this one isn't relevant
    onHover: (id: number | null) => void;
}

export const ClassifiedItem: React.FC<ClassifiedItemProps> = ({
    objective,
    match,
    isActive,
    isSubdued,
    onHover
}) => {
    // Determine style based on state
    let className = "p-4 border rounded shadow-sm transition-all duration-200 cursor-pointer ";

    if (isActive) {
        className += "border-blue-500 bg-blue-50 ring-2 ring-blue-200 ";
    } else if (match?.canComplete) {
        className += "border-green-200 bg-green-50 hover:bg-green-100 ";
    } else if (match && !match.canComplete) {
        className += "border-red-200 bg-opacity-50 "; // slightly grayed out if impossible?
    } else {
        className += "border-gray-200 hover:border-blue-300 ";
    }

    if (isSubdued) {
        className += "opacity-40 grayscale ";
    }

    return (
        <div
            className={className}
            onMouseEnter={() => onHover(objective.id)}
            onMouseLeave={() => onHover(null)}
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg">{objective.name}</h3>
                <span className="text-xs font-mono text-gray-500">{objective.category.split(' ')[0]}</span>
            </div>

            <p className="text-sm text-gray-700 mb-3">{objective.objective}</p>

            <div className="text-xs bg-gray-100 p-2 rounded">
                <strong>Designated:</strong> {objective.designatedTroopers.join(', ')}
            </div>

            {match && match.canComplete && (
                <div className="mt-2 text-xs text-green-700 font-bold">
                    ✓ Completable via {match.reason}
                </div>
            )}
        </div>
    );
};
