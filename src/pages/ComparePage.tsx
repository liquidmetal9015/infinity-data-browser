import { useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useModal } from '../context/ModalContext';
import { Users, Check, Layers } from 'lucide-react';
import { useCompareStore } from '../stores/useCompareStore';
import { MultiFactionSelector } from '../components/MultiFactionSelector';
import './ComparePage.css';

export function ComparePage() {
    const db = useDatabase();
    const { openUnitModal } = useModal();
    const { selectedFactionIds, setFactions, addMultipleFactions, clearAll } = useCompareStore();

    const getLogoUrl = (logo: string | undefined | null) => {
        if (!logo) return null;
        if (logo.startsWith('http')) return logo;
        return `${import.meta.env.BASE_URL}${logo.replace(/^\//, '')}`;
    };

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
            .sort((a, b) => (a!.name || a!.isc || '').localeCompare(b!.name || b!.isc || ''))
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

    const addSuperFaction = (superId: number) => {
        const superFaction = groupedFactions.find(sf => sf.id === superId);
        if (!superFaction) return;

        const validIds = new Set(allFactions.map(f => f.id));
        const idsToAdd: number[] = [];

        if (superFaction.vanilla && validIds.has(superFaction.vanilla.id)) {
            idsToAdd.push(superFaction.vanilla.id);
        }

        superFaction.sectorials.forEach(child => {
            if (validIds.has(child.id)) {
                idsToAdd.push(child.id);
            }
        });

        addMultipleFactions(idsToAdd);
    };

    return (
        <div className="page-container compare-page">

            {/* Controls */}
            <div className="controls-section">

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full">
                    <div className="flex-1">
                        <MultiFactionSelector
                            value={selectedFactionIds}
                            onChange={setFactions}
                            groupedFactions={groupedFactions}
                            placeholder="Search & Add Factions..."
                        />
                    </div>
                    <button
                        onClick={clearAll}
                        className="px-6 py-4 bg-[#18181b] hover:bg-[#1f1f23] border border-[#ffffff14] text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap h-[58px]"
                        disabled={selectedFactions.length === 0}
                    >
                        Clear All
                    </button>
                </div>

                {/* Quick Add Buttons */}
                <div className="flex flex-wrap items-center gap-3 mt-4 w-full bg-gray-900/50 p-4 rounded-xl border border-gray-800/60">
                    <span className="text-sm font-bold text-gray-400 mr-1 uppercase tracking-wider">Quick Compare</span>
                    <div className="w-px h-6 bg-gray-700 mx-2 hidden sm:block"></div>
                    {groupedFactions.map(sf => {
                        const hasLogo = sf.vanilla?.logo || (sf.sectorials.length > 0 ? sf.sectorials[0].logo : undefined);
                        const logoSrc = getLogoUrl(hasLogo);

                        return (
                            <button
                                key={sf.id}
                                onClick={() => addSuperFaction(sf.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-base font-semibold text-gray-200 transition-colors shadow-md hover:shadow-lg hover:border-accent-500"
                                title={`Compare all ${sf.name} armies`}
                            >
                                {logoSrc && (
                                    <img src={logoSrc} alt="" className="h-5 w-5 object-contain opacity-90" />
                                )}
                                {sf.name}
                            </button>
                        );
                    })}
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
                                        {u.name || u.isc || 'Unknown'}
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
                                                        <span key={f.id} className="group-tag flex items-center gap-2 px-3 py-1.5 rounded bg-gray-800/80 border" style={{ borderColor: color }}>
                                                            {getLogoUrl(f.logo) && <img src={getLogoUrl(f.logo) as string} alt="" className="h-6 w-6 object-contain opacity-90" />}
                                                            <span style={{ color }} className="text-base font-semibold">{f.name}</span>
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
                                                    {unit.name || unit.isc || 'Unknown'}
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
                                        <div className="column-header flex flex-col items-center pb-2">
                                            {getLogoUrl(f.logo) && <img src={getLogoUrl(f.logo) as string} alt="" className="h-8 w-8 object-contain mb-2 opacity-90" />}
                                            <h4 style={{ color }} className="text-center font-bold text-lg">{f.name}</h4>
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
                                                        {u.name || u.isc || 'Unknown'}
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
