import { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useModal } from '../context/ModalContext';
import { Users, X, Check, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './ComparePage.css';

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
    }, [db]);

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

    }, [selectedFactionIds, allFactions, db]);

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
        </div>
    );
}
