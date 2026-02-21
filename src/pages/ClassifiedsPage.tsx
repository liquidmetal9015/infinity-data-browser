import { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { FactionSelector } from '../components/ListBuilder/FactionSelector';
import { ClassifiedItem } from '../components/Classifieds/ClassifiedItem';
import { getClassifiedsForOption, type ClassifiedMatch } from '../../shared/classifieds';
import type { Unit, Profile, Option } from '../../shared/types';
import { ChevronLeft } from 'lucide-react';

export function ClassifiedsPage() {
    const db = useDatabase();
    const [selectedFactionId, setSelectedFactionId] = useState<number | null>(null);
    const [selectedClassified, setSelectedClassified] = useState<number | null>(null);
    const [selectedUnitISC, setSelectedUnitISC] = useState<string | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);

    // Filter units for the selected faction
    const factionUnits = useMemo(() => {
        if (!selectedFactionId) return [];
        return db.units
            .filter(u => u.factions.includes(selectedFactionId))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db.units, selectedFactionId]);

    // Pre-calculate matches for all units and profiles
    const unitMatches = useMemo(() => {
        if (!selectedFactionId || !db.classifieds.length) return null;

        const metadata = {
            skills: db.skillMap,
            equips: db.equipmentMap
        };

        const matches = new Map<string, {
            unit: Unit,
            completableClassifieds: Set<number>,
            profileMatches: {
                profile: Profile,
                option: Option,
                matches: ClassifiedMatch[]
            }[]
        }>();

        factionUnits.forEach(unit => {
            const unitEntry = {
                unit,
                completableClassifieds: new Set<number>(),
                profileMatches: [] as any[]
            };

            unit.raw.profileGroups.forEach(pg => {
                pg.profiles.forEach(profile => {
                    pg.options.forEach(option => {
                        const optionMatches = getClassifiedsForOption(
                            unit,
                            profile,
                            option,
                            db.classifieds,
                            metadata
                        );

                        // If this option can complete any classifieds, record it
                        const validMatches = optionMatches.filter(m => m.canComplete);
                        if (validMatches.length > 0) {
                            validMatches.forEach(m => unitEntry.completableClassifieds.add(m.objectiveId));
                            unitEntry.profileMatches.push({
                                profile,
                                option,
                                matches: validMatches
                            });
                        }
                    });
                });
            });

            if (unitEntry.completableClassifieds.size > 0) {
                matches.set(unit.isc, unitEntry);
            }
        });

        return matches;
    }, [db.classifieds, factionUnits, db.skillMap, db.equipmentMap]);


    if (!selectedFactionId) {
        return (
            <div className="page-container">
                <FactionSelector
                    groupedFactions={db.getGroupedFactions()}
                    onFactionClick={setSelectedFactionId}
                    title="Classifieds Analysis"
                    subtitle="Select a faction to view which units can complete which classified objectives."
                />
            </div>
        );
    }

    const factionName = db.getFactionName(selectedFactionId);

    return (
        <div className="page-container">
            {/* Header */}
            <div className="search-header flex-row items-center border-b border-border pb-4 mb-6">
                <button
                    onClick={() => {
                        setSelectedFactionId(null);
                        setSelectedUnitISC(null);
                        setSelectedClassified(null);
                        setSelectedProfileId(null);
                    }}
                    className="mr-4 p-2 bg-bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary rounded-xl transition-colors"
                    title="Change Faction"
                >
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-text-primary m-0">Classifieds Analysis</h1>
                    <p className="text-sm text-text-secondary m-0">{factionName}</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="classifieds-grid gap-6">

                {/* Left Column: Objectives */}
                <div className="objectives-column flex flex-col gap-4">
                    <div className="column-header">
                        <h2>Objectives</h2>
                        <span className="badge">{db.classifieds.length}</span>
                    </div>

                    <div className="objectives-list custom-scrollbar">
                        {db.classifieds.map(cls => {
                            // Determine relevance based on selected unit AND selected profile
                            let isRelevantToUnit = false;

                            if (selectedUnitISC && unitMatches) {
                                const matchData = unitMatches.get(selectedUnitISC);
                                if (matchData) {
                                    if (selectedProfileId) {
                                        // Check if the specific selected profile can complete it
                                        isRelevantToUnit = matchData.profileMatches.some(pm =>
                                            pm.option.id === selectedProfileId &&
                                            pm.matches.some(m => m.objectiveId === cls.id)
                                        );
                                    } else {
                                        // Check if ANY profile in the unit can complete it
                                        isRelevantToUnit = matchData.completableClassifieds.has(cls.id);
                                    }
                                }
                            }

                            const isActive = selectedClassified === cls.id || !!isRelevantToUnit;
                            const isSubdued = !!selectedUnitISC && !isRelevantToUnit;

                            return (
                                <ClassifiedItem
                                    key={cls.id}
                                    objective={cls}
                                    isActive={isActive}
                                    isSubdued={isSubdued}
                                    match={selectedUnitISC && isRelevantToUnit ? {
                                        objectiveId: cls.id,
                                        canComplete: true,
                                        reason: `Matching Requirements`
                                    } : undefined}
                                    onClick={() => {
                                        if (isActive && selectedClassified === cls.id) {
                                            setSelectedClassified(null);
                                        } else {
                                            setSelectedClassified(cls.id);
                                            setSelectedUnitISC(null); // Explicit selection mode
                                            setSelectedProfileId(null);
                                        }
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Units */}
                <div className="units-column flex flex-col gap-4">
                    <div className="column-header">
                        <h2>Available Units</h2>
                        <span className="badge">{factionUnits.length}</span>
                        {selectedClassified && (
                            <div className="active-filter-badge">
                                Filtered: {db.classifieds.find(c => c.id === selectedClassified)?.name}
                            </div>
                        )}
                    </div>

                    <div className="units-grid">
                        {factionUnits.map(unit => {
                            const matchData = unitMatches?.get(unit.isc);

                            // If NO profiles in this unit can do anything, don't show it at all
                            if (!matchData) return null;

                            const canCompleteFocused = selectedClassified ? matchData.completableClassifieds.has(selectedClassified) : true;
                            const isSelected = selectedUnitISC === unit.isc;

                            return (
                                <div
                                    key={unit.isc}
                                    className={`
                                        unit-card
                                        ${isSelected ? 'selected' : ''}
                                        ${selectedClassified && !canCompleteFocused ? 'subdued' : ''}
                                        ${selectedClassified && canCompleteFocused ? 'highlighted' : ''}
                                    `}
                                    onClick={() => {
                                        // Unit-level selection is less relevant now that profiles are explicit, 
                                        // but we can still allow clicking the card header to select the unit and clear objective mode
                                        if (isSelected) {
                                            setSelectedUnitISC(null);
                                            setSelectedProfileId(null);
                                        } else {
                                            setSelectedUnitISC(unit.isc);
                                            setSelectedProfileId(null);
                                            setSelectedClassified(null); // Explicit selection mode
                                        }
                                    }}
                                >
                                    <div className="unit-card-header">
                                        <h3 className="unit-name">{unit.name}</h3>
                                        {canCompleteFocused && selectedClassified && (
                                            <span className="match-indicator">Match</span>
                                        )}
                                    </div>

                                    {/* Static Profile List */}
                                    <div className="static-profile-list" onClick={e => e.stopPropagation()}>
                                        {matchData.profileMatches.map((pm, idx) => {
                                            const isProfileSelected = selectedProfileId === pm.option.id && isSelected;
                                            const matchesFocused = selectedClassified ? pm.matches.some(m => m.objectiveId === selectedClassified) : true;

                                            // Don't show the profile if it doesn't match the selected classified (when filtering by obj)
                                            if (selectedClassified && !matchesFocused) return null;

                                            // Resolve item names using lookups to give the static profile real details
                                            const weapons = pm.option.weapons.map(w => db.weaponMap.get(Math.abs(w.id)) || `Weapon ${w.id}`).filter(Boolean);
                                            const skills = pm.option.skills.map(s => db.skillMap.get(Math.abs(s.id)) || `Skill ${s.id}`).filter(Boolean);
                                            const equips = pm.option.equip.map(e => db.equipmentMap.get(Math.abs(e.id)) || `Equip ${e.id}`).filter(Boolean);
                                            const loadoutText = [...weapons, ...skills, ...equips].join(', ');

                                            return (
                                                <div key={`${pm.profile.id}-${pm.option.id}-${idx}`} className="profile-row-container">
                                                    <div
                                                        className={`profile-row ${isProfileSelected ? 'active' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // Always ensure this unit is set as selected to avoid weird state mismatches
                                                            setSelectedUnitISC(unit.isc);
                                                            setSelectedProfileId(isProfileSelected ? null : pm.option.id);
                                                            setSelectedClassified(null); // Explicit selection clears objective
                                                        }}
                                                    >
                                                        <div className="profile-row-header">
                                                            <div className="profile-name-tag">{pm.option.name || "Standard Profile"}</div>
                                                            <div className="profile-stats-tag">{pm.matches.length} Objs</div>
                                                        </div>
                                                        <div className="profile-loadout">{loadoutText || "Standard Loadout"}</div>
                                                    </div>

                                                    {/* If explicitly selected, show details on HOW it matches objectives */}
                                                    {isProfileSelected && (
                                                        <div className="profile-match-reasons">
                                                            <div className="reasons-header">Can complete:</div>
                                                            {pm.matches.map((m, mIdx) => {
                                                                const objName = db.classifieds.find(c => c.id === m.objectiveId)?.name || 'Objective';
                                                                return (
                                                                    <div key={mIdx} className="reason-row">
                                                                        <div className="reason-obj">{objName}</div>
                                                                        <div className="reason-text">Via: {m.reason}</div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <style>{`
                .page-container {
                    padding: 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .search-header {
                    display: flex;
                    align-items: center;
                }
                .classifieds-grid {
                    display: grid;
                    grid-template-columns: 350px 1fr;
                    height: calc(100vh - 160px); /* Fill remaining height */
                }
                
                @media (max-width: 1024px) {
                    .classifieds-grid {
                        grid-template-columns: 1fr;
                        height: auto;
                    }
                }

                .column-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid var(--border);
                }
                .column-header h2 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .badge {
                    background: var(--surface-hover);
                    color: var(--text-secondary);
                    padding: 0.1rem 0.6rem;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    border: 1px solid var(--border);
                }
                .active-filter-badge {
                    background: rgba(99, 102, 241, 0.1);
                    color: var(--accent);
                    padding: 0.2rem 0.6rem;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    margin-left: auto;
                }

                /* Objectives Column */
                .objectives-column {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-xl);
                    padding: 1.25rem;
                    display: flex;
                    flex-direction: column;
                }
                .objectives-list {
                    flex: 1;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    padding-right: 0.5rem;
                }

                /* Units Column */
                .units-column {
                    display: flex;
                    flex-direction: column;
                }
                .units-grid {
                    flex: 1;
                    overflow-y: auto;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 1rem;
                    align-content: start;
                    padding-right: 0.5rem;
                    padding-bottom: 2rem;
                }

                /* Unit Card */
                .unit-card {
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1rem;
                    cursor: pointer;
                    transition: all var(--transition-base);
                    display: flex;
                    flex-direction: column;
                }
                .unit-card:hover {
                    border-color: var(--accent-hover);
                    background: var(--surface-hover);
                }
                .unit-card.selected {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 1px var(--accent);
                    background: var(--bg-elevated);
                }
                .unit-card.highlighted {
                    background: rgba(34, 197, 94, 0.05);
                    border-color: rgba(34, 197, 94, 0.3);
                }
                .unit-card.highlighted:hover {
                    background: rgba(34, 197, 94, 0.1);
                    border-color: rgba(34, 197, 94, 0.5);
                }
                .unit-card.subdued {
                    opacity: 0.3;
                    filter: saturate(0);
                }
                .unit-card.subdued:hover {
                    opacity: 0.6;
                    filter: saturate(0.5);
                }
                
                .unit-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .unit-name {
                    margin: 0;
                    font-size: 1.05rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .match-indicator {
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    color: var(--success);
                    background: rgba(34, 197, 94, 0.15);
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                }

                /* Profile Level Interaction */
                .static-profile-list {
                    margin-top: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .profile-row-container {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                .profile-row {
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    padding: 0.6rem 0.75rem;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                }
                .profile-row:hover {
                    border-color: var(--text-secondary);
                    background: var(--surface-hover);
                }
                .profile-row.active {
                    background: rgba(99, 102, 241, 0.1);
                    border-color: var(--accent);
                    box-shadow: inset 2px 0 0 0 var(--accent);
                }
                .profile-row-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .profile-name-tag {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .profile-stats-tag {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                    background: var(--surface);
                    padding: 0.1rem 0.4rem;
                    border-radius: 4px;
                    font-weight: 500;
                }
                .profile-loadout {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    line-height: 1.3;
                }
                
                .profile-match-reasons {
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    overflow: hidden;
                }
                .reason-row {
                    padding: 0.5rem 0.75rem;
                    border-bottom: 1px solid var(--border);
                    font-size: 0.85rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.2rem;
                }
                .reason-row:last-child {
                    border-bottom: none;
                }
                .reason-obj {
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .reason-text {
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                }
            `}</style>
        </div>
    );
}
