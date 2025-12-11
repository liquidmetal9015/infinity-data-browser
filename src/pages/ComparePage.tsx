import { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Users, Info, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ComparePage() {
    const db = useDatabase();
    const [selectedFactionIds, setSelectedFactionIds] = useState<number[]>([]);

    // Get all factions (parents and sectorials)
    const allFactions = useMemo(() => {
        if (!db.metadata) return [];
        return db.metadata.factions
            .filter(f => !f.discontinued)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db.metadata]);

    const availableFactions = useMemo(() => {
        return allFactions.filter(f => !selectedFactionIds.includes(f.id));
    }, [allFactions, selectedFactionIds]);

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

        return {
            universal: sortUnits(universal),
            shared: shared.map(item => ({
                unit: getUnit(item.unitId)!,
                factions: item.factionIds
            })).sort((a, b) => a.unit.name.localeCompare(b.unit.name)),
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

    const removeFaction = (id: number) => {
        setSelectedFactionIds(selectedFactionIds.filter(fid => fid !== id));
    };

    return (
        <div className="page-container compare-page">
            <div className="header-section">
                <h2>Shared Unit Analysis</h2>
                <p>Select multiple factions to analyze shared availability and unique units.</p>
            </div>

            {/* Controls */}
            <div className="controls-section">
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
                </div>

                <div className="add-dropdown">
                    <select onChange={handleAddFaction} value="">
                        <option value="">+ Add Faction</option>
                        {availableFactions.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Analysis Results */}
            {!analysis ? (
                <div className="empty-state">
                    <Info size={48} className="text-secondary" />
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
                                    <div key={u.id} className="unit-card universal">
                                        {u.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. Partially Shared */}
                    {analysis.shared.length > 0 && (
                        <div className="section shared-section">
                            <h3>
                                <Users size={20} />
                                Shared Units (Partial Overlap)
                                <span className="count-badge">{analysis.shared.length}</span>
                            </h3>
                            <div className="unit-list-grid">
                                {analysis.shared.map(({ unit, factions }) => (
                                    <div key={unit.id} className="unit-card shared">
                                        <div className="unit-name">{unit.name}</div>
                                        <div className="faction-dots">
                                            {factions.map(fid => {
                                                // Ideally we show logos, but for now simple dots with tooltip
                                                const f = allFactions.find(af => af.id === fid);
                                                return (
                                                    <div
                                                        key={fid}
                                                        className="dot"
                                                        title={f?.name}
                                                    />
                                                );
                                            })}
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
                                return (
                                    <div key={f.id} className="faction-column">
                                        <div className="column-header">
                                            <h4>{f.name}</h4>
                                            <span className="count">{units.length} unique</span>
                                        </div>
                                        <div className="column-content">
                                            {units.length === 0 ? (
                                                <div className="empty-col">- No unique units -</div>
                                            ) : (
                                                units.map(u => (
                                                    <div key={u.id} className="unit-item-compact">
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
                    gap: 1rem;
                    margin-bottom: 3rem;
                }
                .selected-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    justify-content: center;
                    min-height: 40px;
                }
                .faction-chip {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: var(--color-primary);
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 100px;
                    font-size: 0.9rem;
                    font-weight: 500;
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
                .add-dropdown select {
                    padding: 0.75rem 1.5rem;
                    border-radius: 100px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    cursor: pointer;
                    font-size: 1rem;
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
                    gap: 2px;
                }
                .dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--text-secondary);
                }

                .unique-columns-wrapper h3 {
                    text-align: center;
                    margin-bottom: 1.5rem;
                }
                .unique-columns {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }
                .faction-column {
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    display: flex;
                    flex-direction: column;
                }
                .column-header {
                    padding: 1rem;
                    border-bottom: 1px solid var(--border-color);
                    background: rgba(0,0,0,0.05);
                    text-align: center;
                }
                .column-header h4 {
                    margin: 0;
                    font-size: 1rem;
                }
                .column-header .count {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }
                .column-content {
                    padding: 1rem;
                    flex: 1;
                }
                .unit-item-compact {
                    padding: 0.35rem 0;
                    border-bottom: 1px solid var(--border-color);
                    font-size: 0.9rem;
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
