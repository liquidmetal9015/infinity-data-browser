import { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useModal } from '../context/ModalContext';
import { Users, X, Check, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ComparePage() {
    const db = useDatabase();
    const { openUnitModal } = useModal();
    const [selectedFactionIds, setSelectedFactionIds] = useState<number[]>([]);

    // Get all factions
    const allFactions = useMemo(() => {
        if (!db.metadata) return [];
        return db.metadata.factions
            .filter(f => db.factionHasData(f.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db.metadata]);

    const groupedFactions = useMemo(() => {
        return db.getGroupedFactions();
    }, [db]);



    const selectedFactions = useMemo(() => {
        return selectedFactionIds.map(id => allFactions.find(f => f.id === id)).filter(Boolean) as typeof allFactions;
    }, [selectedFactionIds, allFactions]);

    const analysis = useMemo(() => {
        if (selectedFactionIds.length < 2) return null;

        // Map faction ID -> Set of Unit IDs
        const factionUnitMap = new Map<number, Set<number>>();

        selectedFactionIds.forEach(fid => {
            const unitIds = new Set<number>();
            db.units.forEach(u => {
                if (u.factions.includes(fid)) {
                    unitIds.add(u.id);
                }
            });
            factionUnitMap.set(fid, unitIds);
        });

        // Determine buckets
        const universal: number[] = [];
        const shared: { unitId: number; factionIds: number[] }[] = [];
        const unique: Record<number, number[]> = {}; // factionId -> unitIds[]

        // Initialize unique buckets
        selectedFactionIds.forEach(fid => unique[fid] = []);

        // Iterate all unique units involved in any selected faction
        const allInvolvedUnitIds = new Set<number>();
        factionUnitMap.forEach(set => set.forEach(uid => allInvolvedUnitIds.add(uid)));

        allInvolvedUnitIds.forEach(uid => {
            const presentInFactions: number[] = [];
            selectedFactionIds.forEach(fid => {
                if (factionUnitMap.get(fid)?.has(uid)) {
                    presentInFactions.push(fid);
                }
            });

            if (presentInFactions.length === selectedFactionIds.length) {
                universal.push(uid);
            } else if (presentInFactions.length === 1) {
                unique[presentInFactions[0]].push(uid);
            } else if (presentInFactions.length > 1) {
                shared.push({ unitId: uid, factionIds: presentInFactions });
            }
        });

        // Sort data for display
        const getUnit = (id: number) => db.units.find(u => u.id === id);
        const sortUnits = (ids: number[]) => ids
            .map(id => getUnit(id))
            .filter(u => u !== undefined)
            .sort((a, b) => a!.name.localeCompare(b!.name))
            .map(u => u!);

        // Group shared units by faction combination
        const sharedGroupsMap = new Map<string, { factions: number[], units: number[] }>();

        shared.forEach(item => {
            const key = item.factionIds.sort((a, b) => a - b).join(',');
            if (!sharedGroupsMap.has(key)) {
                sharedGroupsMap.set(key, { factions: item.factionIds, units: [] });
            }
            sharedGroupsMap.get(key)!.units.push(item.unitId);
        });

        const sharedGroups = Array.from(sharedGroupsMap.values()).map(group => ({
            factions: group.factions.map(fid => allFactions.find(f => f.id === fid)).filter(f => f !== undefined) as typeof allFactions,
            units: sortUnits(group.units)
        })).filter(g => g.factions.length > 1) // Ensure we have valid groups
            .sort((a, b) => b.factions.length - a.factions.length); // Sort by most overlapping first

        return {
            universal: sortUnits(universal),
            sharedGroups,
            unique: Object.entries(unique).reduce((acc, [fid, uids]) => {
                acc[Number(fid)] = sortUnits(uids);
                return acc;
            }, {} as Record<number, typeof db.units>)
        };

    }, [selectedFactionIds, db.units]);

    const handleAddFaction = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = Number(e.target.value);
        if (id && !selectedFactionIds.includes(id)) {
            setSelectedFactionIds([...selectedFactionIds, id]);
        }
    };

    const addSuperFaction = (superId: number) => {
        const superFaction = groupedFactions.find(sf => sf.id === superId);
        if (!superFaction) return;

        const validIds = new Set(allFactions.map(f => f.id));
        const newIds = new Set(selectedFactionIds);

        // Only add if they are valid (not discontinued/hidden)
        if (validIds.has(superFaction.id) && !newIds.has(superFaction.id)) {
            newIds.add(superFaction.id);
        }

        superFaction.sectorials.forEach(child => {
            if (validIds.has(child.id) && !newIds.has(child.id)) {
                newIds.add(child.id);
            }
        });

        setSelectedFactionIds(Array.from(newIds));
    };

    const removeFaction = (id: number) => {
        setSelectedFactionIds(selectedFactionIds.filter(fid => fid !== id));
    };

    const clearAll = () => setSelectedFactionIds([]);

    return (
        <div className="page-container compare-page">
            <div className="header-section">
                <h2>Shared Unit Analysis</h2>
                <p>Select multiple factions to analyze shared availability and unique units.</p>
            </div>

            {/* Controls */}
            <div className="controls-section">

                {/* Visual Chip List */}
                <div className="selection-area">
                    <div className="selection-header">
                        <span className="label">Selected Factions ({selectedFactions.length})</span>

                    </div>
                    <div className="selected-chips">
                        <AnimatePresence>
                            {selectedFactions.map(f => (
                                <motion.div
                                    key={f.id}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="faction-chip"
                                >
                                    <span>{f.name}</span>
                                    <button onClick={() => removeFaction(f.id)}><X size={14} /></button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {selectedFactions.length === 0 && (
                            <span className="placeholder-text">None selected</span>
                        )}
                    </div>
                </div>

                <div className="action-row">
                    <div className="add-dropdown">
                        <select onChange={handleAddFaction} value="">
                            <option value="">+ Add Single Faction</option>
                            {groupedFactions.map(group => {
                                // Calculate available options for this group
                                const vanillaAvailable = group.vanilla && !selectedFactionIds.includes(group.vanilla.id);
                                const availableSectorials = group.sectorials.filter(s => !selectedFactionIds.includes(s.id));

                                // If nothing available in this group, don't render it
                                if (!vanillaAvailable && availableSectorials.length === 0) return null;

                                return (
                                    <optgroup key={group.id} label={group.name}>
                                        {vanillaAvailable && (
                                            <option value={group.vanilla!.id}>{group.vanilla!.name}</option>
                                        )}
                                        {availableSectorials.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </optgroup>
                                );
                            })}
                        </select>
                        <button
                            onClick={clearAll}
                            className="compare-clear-btn"
                            disabled={selectedFactions.length === 0}
                        >
                            Clear All
                        </button>
                    </div>

                    <div className="super-faction-actions">
                        <span className="label">Quick Add:</span>
                        {groupedFactions.map(sf => (
                            <button
                                key={sf.id}
                                onClick={() => addSuperFaction(sf.id)}
                                className="super-btn"
                                title={`Add all ${sf.name} factions`}
                            >
                                {sf.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Analysis Results */}
            {!analysis ? (
                <div className="empty-state">
                    <Layers size={48} className="text-secondary" />
                    <p>Select at least two factions to compare overlapping units.</p>
                </div>
            ) : (
                <div className="analysis-grid">
                    {/* 1. Universal Units */}
                    {analysis.universal.length > 0 && (
                        <div className="section universal-section">
                            <h3>
                                <Check size={20} />
                                Universal Units
                                <span className="count-badge">{analysis.universal.length}</span>
                            </h3>
                            <div className="unit-list-row">
                                {analysis.universal.map(u => (
                                    <div
                                        key={u.id}
                                        className="unit-card universal cursor-pointer hover:border-success/80 transition-colors"
                                        onClick={() => openUnitModal(u)}
                                    >
                                        {u.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. Partially Shared Groups */}
                    {analysis.sharedGroups.length > 0 && (
                        <div className="section shared-section">
                            <h3>
                                <Users size={20} />
                                Shared Units (Partial Overlap)
                            </h3>
                            <div className="shared-groups-container">
                                {analysis.sharedGroups.map((group, idx) => (
                                    <div key={idx} className="shared-group-block">
                                        <div className="group-header">
                                            <div className="faction-tags">
                                                {group.factions.map(f => {
                                                    const color = `hsl(${(f.id * 137.5) % 360}, 70%, 50%)`;
                                                    return (
                                                        <span key={f.id} className="group-tag" style={{ borderLeftColor: color }}>
                                                            {f.name}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            <span className="count-badge">{group.units.length}</span>
                                        </div>
                                        <div className="unit-list-row">
                                            {group.units.map(unit => (
                                                <div
                                                    key={unit.id}
                                                    className="unit-card shared cursor-pointer hover:border-primary/80 transition-colors"
                                                    onClick={() => openUnitModal(unit)}
                                                >
                                                    {unit.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3. Unique Units Columns */}
                    <div className="unique-columns-wrapper">
                        <h3>Unique to Faction (Relative to Selection)</h3>
                        <div className="unique-columns">
                            {selectedFactions.map(f => {
                                const units = analysis.unique[f.id] || [];
                                const color = `hsl(${(f.id * 137.5) % 360}, 70%, 50%)`;
                                return (
                                    <div key={f.id} className="faction-column" style={{ borderTopColor: color }}>
                                        <div className="column-header">
                                            <h4 style={{ color }}>{f.name}</h4>
                                            <span className="count">{units.length} unique</span>
                                        </div>
                                        <div className="column-content">
                                            {units.length === 0 ? (
                                                <div className="empty-col">- No unique units -</div>
                                            ) : (
                                                units.map(u => (
                                                    <div
                                                        key={u.id}
                                                        className="unit-item-compact cursor-pointer hover:text-accent transition-colors"
                                                        onClick={() => openUnitModal(u)}
                                                    >
                                                        {u.name}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .compare-page {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 2rem;
                }
                .header-section {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .controls-section {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 3rem;
                    background: var(--bg-secondary);
                    padding: 1.5rem;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                }
                .selection-area {
                    width: 100%;
                    max-width: 800px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .selection-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    background: var(--bg-secondary);
                    border-bottom: 1px solid var(--border-color);
                }
                .selection-header .label {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                }
                .selected-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    padding: 1rem;
                    min-height: 60px;
                    align-content: flex-start;
                }
                .placeholder-text {
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    font-style: italic;
                    width: 100%;
                    text-align: center;
                    padding: 0.5rem;
                }
                .faction-chip {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: var(--color-primary);
                    color: white;
                    padding: 0.4rem 0.8rem;
                    border-radius: 100px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .faction-chip button {
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.8);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    padding: 0;
                }
                .faction-chip button:hover {
                    color: white;
                }
                .compare-clear-btn {
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    font-weight: 500;
                    margin-left: 0.5rem;
                    transition: all 0.2s;
                }
                .compare-clear-btn:hover:not(:disabled) {
                    border-color: var(--color-danger, #ef4444);
                    color: var(--color-danger, #ef4444);
                    background: var(--bg-hover);
                }
                .compare-clear-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    color: var(--text-muted);
                    border-color: transparent;
                }

                .action-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 2rem;
                    align-items: center;
                    justify-content: center;
                }


                .add-dropdown {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .add-dropdown select {
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    cursor: pointer;
                    font-size: 0.95rem;
                    min-width: 200px;
                }

                .super-faction-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                .super-faction-actions .label {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    margin-right: 0.5rem;
                }
                .super-btn {
                    padding: 0.4rem 0.8rem;
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: var(--text-primary);
                }
                .super-btn:hover {
                    background: var(--bg-hover);
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                }
                
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                    padding: 4rem;
                    border: 2px dashed var(--border-color);
                    border-radius: 12px;
                    color: var(--text-secondary);
                }

                .analysis-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                }

                .section {
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    padding: 1.5rem;
                    border: 1px solid var(--border-color);
                }
                .section h3 {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                    font-size: 1.2rem;
                    color: var(--text-primary);
                }
                .count-badge {
                    background: var(--bg-primary);
                    padding: 0.2rem 0.6rem;
                    border-radius: 100px;
                    font-size: 0.8rem;
                    border: 1px solid var(--border-color);
                }

                .unit-list-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                }
                .unit-card {
                    padding: 0.5rem 1rem;
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    font-size: 0.95rem;
                }
                .unit-card.universal {
                    border-color: var(--color-success, #22c55e);
                    background: rgba(34, 197, 94, 0.1);
                }

                .unit-list-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 0.75rem;
                }
                .unit-card.shared {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .faction-dots {
                    display: flex;
                    gap: 4px;
                }
                .dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    border: 1px solid rgba(0,0,0,0.1);
                }

                .shared-groups-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .shared-group-block {
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 1rem;
                }
                .group-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 0.5rem;
                }
                .faction-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                .group-tag {
                    font-size: 0.85rem;
                    font-weight: 500;
                    padding: 0.1rem 0.5rem;
                    background: var(--bg-secondary);
                    border-radius: 4px;
                    border-left: 3px solid transparent;
                }

                .unique-columns-wrapper h3 {
                    text-align: center;
                    margin-bottom: 1.5rem;
                }
                .unique-columns {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 1rem;
                }
                .faction-column {
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    border-top-width: 4px;
                    display: flex;
                    flex-direction: column;
                }
                .column-header {
                    padding: 1rem;
                    border-bottom: 1px solid var(--border-color);
                    background: rgba(0,0,0,0.02);
                    text-align: center;
                }
                .column-header h4 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                }
                .column-header .count {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }
                .column-content {
                    padding: 1rem;
                    flex: 1;
                    max-height: 500px;
                    overflow-y: auto;
                }
                .unit-item-compact {
                    padding: 0.4rem 0.5rem;
                    border-bottom: 1px solid var(--border-color);
                    font-size: 0.9rem;
                    border-radius: 4px;
                }
                .unit-item-compact:hover {
                    background: var(--bg-hover);
                }
                .unit-item-compact:last-child {
                    border-bottom: none;
                }
                .empty-col {
                    text-align: center;
                    color: var(--text-muted);
                    font-size: 0.85rem;
                    font-style: italic;
                    margin-top: 2rem;
                }
            `}</style>
        </div>
    );
}
