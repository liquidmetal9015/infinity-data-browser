// Faction Selector Grid Component
import { ChevronRight, Shield, Upload } from 'lucide-react';
import type { SuperFaction } from '../../types';

interface FactionSelectorProps {
    groupedFactions: SuperFaction[];
    onFactionClick: (factionId: number) => void;
    onImportClick?: () => void;
    title?: string;
    subtitle?: string;
}

export function FactionSelector({
    groupedFactions,
    onFactionClick,
    onImportClick,
    title = "Army Builder",
    subtitle = "Select a faction to begin, or import an existing army code"
}: FactionSelectorProps) {
    return (
        <>
            <div className="faction-selector-hero">
                <h1>{title}</h1>
                <p>{subtitle}</p>
                {onImportClick && (
                    <button className="import-btn" onClick={onImportClick}>
                        <Upload size={18} />
                        Import Army Code
                    </button>
                )}
            </div>

            <div className="faction-grid-container">
                {groupedFactions.map(superFaction => (
                    <div key={superFaction.id} className="super-faction-card">
                        <div className="super-faction-header">
                            <div className="faction-icon">
                                <Shield size={24} />
                            </div>
                            <h3>{superFaction.name}</h3>
                        </div>

                        <div className="sectorial-list">
                            {/* Vanilla Option */}
                            {superFaction.vanilla && (
                                <button
                                    className="sectorial-btn vanilla"
                                    onClick={() => onFactionClick(superFaction.vanilla!.id)}
                                >
                                    <span className="btn-label">Vanilla / General</span>
                                    <ChevronRight size={16} />
                                </button>
                            )}

                            {/* Sectorials */}
                            {superFaction.sectorials.map(faction => (
                                <button
                                    key={faction.id}
                                    className="sectorial-btn"
                                    onClick={() => onFactionClick(faction.id)}
                                >
                                    <span className="btn-label">{faction.name}</span>
                                    {faction.discontinued && <span className="tag-disc">Legacy</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
