import React from 'react';
import type { ClassifiedObjective, ClassifiedMatch } from '../../../shared/classifieds';
import './ClassifiedItem.css';

interface ClassifiedItemProps {
    objective: ClassifiedObjective;
    match?: ClassifiedMatch;
    isActive: boolean; // Hovered or selected
    isSubdued: boolean; // If another item is active and this one isn't relevant
    onClick: () => void;
}

export const ClassifiedItem: React.FC<ClassifiedItemProps> = ({
    objective,
    match,
    isActive,
    isSubdued,
    onClick
}) => {
    let className = "classified-item ";

    if (isActive) {
        className += "active ";
    } else if (match?.canComplete) {
        className += "completable ";
    }

    if (isSubdued) {
        className += "subdued ";
    }

    return (
        <div className={className.trim()} onClick={onClick}>
            <div className="classified-header">
                <h3 className="classified-title">{objective.name}</h3>
                <span className="classified-category">{objective.category.split(' ')[0]}</span>
            </div>

            <p className="classified-desc">{objective.objective}</p>

            <div className="classified-designated">
                <span className="designated-label">Designated:</span> {objective.designatedTroopers.join(', ')}
            </div>

            {match && match.canComplete && match.reason && (
                <div className="classified-match-status">
                    <span className="match-icon">✓</span> Completable via {match.reason}
                </div>
            )}
        </div>
    );
};
