import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Layers, List, GitCompare } from 'lucide-react';
import { Database } from '../services/Database';
import type { Unit } from '../types';

interface FactionViewProps {
    units: Unit[];
}

type ViewMode = 'flat' | 'grouped' | 'comparison';

interface SuperFactionGroup {
    id: number;
    name: string;
    factions: { id: number; name: string; units: string[]; hasAccess: boolean }[];
}

export const FactionView: React.FC<FactionViewProps> = ({ units }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('flat');
    const db = Database.getInstance();

    // Build faction -> units mapping
    const factionMap = useMemo(() => {
        const map: Record<number, Unit[]> = {};
        units.forEach(u => {
            u.factions.forEach(fid => {
                if (!map[fid]) map[fid] = [];
                map[fid].push(u);
            });
        });
        return map;
    }, [units]);

    const allFactionIds = Array.from(db.factionMap.keys());
    const accessFactionIds = new Set(Object.keys(factionMap).map(Number));
    const missingFactionIds = allFactionIds.filter(id => !accessFactionIds.has(id));

    const sortedAccessIds = Object.keys(factionMap).map(Number).sort((a, b) =>
        db.getFactionName(a).localeCompare(db.getFactionName(b))
    );

    // Group factions by super-faction (for grouped mode - access only)
    const groupedAccessFactions = useMemo((): SuperFactionGroup[] => {
        const superFactions = db.getGroupedFactions();
        const groups: SuperFactionGroup[] = [];

        for (const sf of superFactions) {
            const factionsInGroup: { id: number; name: string; units: string[]; hasAccess: boolean }[] = [];

            if (sf.vanilla && accessFactionIds.has(sf.vanilla.id)) {
                const unitNames = Array.from(new Set(factionMap[sf.vanilla.id]?.map(u => u.name) || [])).sort();
                factionsInGroup.push({
                    id: sf.vanilla.id,
                    name: sf.vanilla.shortName + ' (Vanilla)',
                    units: unitNames,
                    hasAccess: true
                });
            }

            for (const sect of sf.sectorials) {
                if (accessFactionIds.has(sect.id)) {
                    const unitNames = Array.from(new Set(factionMap[sect.id]?.map(u => u.name) || [])).sort();
                    factionsInGroup.push({
                        id: sect.id,
                        name: sect.shortName,
                        units: unitNames,
                        hasAccess: true
                    });
                }
            }

            if (factionsInGroup.length > 0) {
                groups.push({ id: sf.id, name: sf.name, factions: factionsInGroup });
            }
        }

        return groups.sort((a, b) => a.name.localeCompare(b.name));
    }, [factionMap, accessFactionIds, db]);

    // Group missing factions by super-faction (for grouped mode)
    const groupedMissingFactions = useMemo((): SuperFactionGroup[] => {
        const superFactions = db.getGroupedFactions();
        const groups: SuperFactionGroup[] = [];
        const missingSet = new Set(missingFactionIds);

        for (const sf of superFactions) {
            const factionsInGroup: { id: number; name: string; units: string[]; hasAccess: boolean }[] = [];

            if (sf.vanilla && missingSet.has(sf.vanilla.id)) {
                factionsInGroup.push({
                    id: sf.vanilla.id,
                    name: sf.vanilla.shortName + ' (Vanilla)',
                    units: [],
                    hasAccess: false
                });
            }

            for (const sect of sf.sectorials) {
                if (missingSet.has(sect.id)) {
                    factionsInGroup.push({
                        id: sect.id,
                        name: sect.shortName,
                        units: [],
                        hasAccess: false
                    });
                }
            }

            if (factionsInGroup.length > 0) {
                groups.push({ id: sf.id, name: sf.name, factions: factionsInGroup });
            }
        }

        return groups.sort((a, b) => a.name.localeCompare(b.name));
    }, [missingFactionIds, db]);

    // Comparison mode: all super-factions with all sectorials showing access status
    const comparisonGroups = useMemo((): SuperFactionGroup[] => {
        const superFactions = db.getGroupedFactions();
        const groups: SuperFactionGroup[] = [];

        for (const sf of superFactions) {
            const factionsInGroup: { id: number; name: string; units: string[]; hasAccess: boolean }[] = [];

            if (sf.vanilla) {
                const hasAccess = accessFactionIds.has(sf.vanilla.id);
                const unitNames = hasAccess
                    ? Array.from(new Set(factionMap[sf.vanilla.id]?.map(u => u.name) || [])).sort()
                    : [];
                factionsInGroup.push({
                    id: sf.vanilla.id,
                    name: sf.vanilla.shortName + ' (Vanilla)',
                    units: unitNames,
                    hasAccess
                });
            }

            for (const sect of sf.sectorials) {
                const hasAccess = accessFactionIds.has(sect.id);
                const unitNames = hasAccess
                    ? Array.from(new Set(factionMap[sect.id]?.map(u => u.name) || [])).sort()
                    : [];
                factionsInGroup.push({
                    id: sect.id,
                    name: sect.shortName,
                    units: unitNames,
                    hasAccess
                });
            }

            if (factionsInGroup.length > 0) {
                groups.push({
                    id: sf.id,
                    name: sf.name,
                    factions: factionsInGroup,
                });
            }
        }

        // Sort: factions with partial access first (mixed), then all access, then no access
        return groups.sort((a, b) => {
            const aHasAny = a.factions.some(f => f.hasAccess);
            const aHasAll = a.factions.every(f => f.hasAccess);
            const bHasAny = b.factions.some(f => f.hasAccess);
            const bHasAll = b.factions.every(f => f.hasAccess);

            // Partial (mixed) first
            const aPartial = aHasAny && !aHasAll;
            const bPartial = bHasAny && !bHasAll;
            if (aPartial && !bPartial) return -1;
            if (!aPartial && bPartial) return 1;

            // Then all access
            if (aHasAll && !bHasAll) return -1;
            if (!aHasAll && bHasAll) return 1;

            // Then alphabetical
            return a.name.localeCompare(b.name);
        });
    }, [factionMap, accessFactionIds, db]);

    return (
        <div className="faction-view">
            {/* View Mode Toggle */}
            <div className="faction-view-controls">
                <div className="view-toggle-group">
                    <button
                        className={`view-toggle-btn ${viewMode === 'flat' ? 'active' : ''}`}
                        onClick={() => setViewMode('flat')}
                        title="Flat list"
                    >
                        <List size={14} />
                        <span>Flat</span>
                    </button>
                    <button
                        className={`view-toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`}
                        onClick={() => setViewMode('grouped')}
                        title="Group by super-faction"
                    >
                        <Layers size={14} />
                        <span>Grouped</span>
                    </button>
                    <button
                        className={`view-toggle-btn ${viewMode === 'comparison' ? 'active' : ''}`}
                        onClick={() => setViewMode('comparison')}
                        title="Compare access across sectorials"
                    >
                        <GitCompare size={14} />
                        <span>Compare</span>
                    </button>
                </div>
            </div>

            {/* Comparison Mode */}
            {viewMode === 'comparison' ? (
                <div className="comparison-view">
                    <div className="comparison-legend">
                        <span className="legend-item access">
                            <CheckCircle2 size={12} />
                            Has Access
                        </span>
                        <span className="legend-item denied">
                            <XCircle size={12} />
                            No Access
                        </span>
                    </div>
                    <div className="super-faction-groups comparison">
                        {comparisonGroups.map((sfGroup, sfIdx) => {
                            const accessCount = sfGroup.factions.filter(f => f.hasAccess).length;
                            const totalCount = sfGroup.factions.length;

                            return (
                                <motion.div
                                    key={sfGroup.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: sfIdx * 0.03 }}
                                    className="super-faction-group comparison"
                                >
                                    <div className="super-faction-header comparison">
                                        <span className="super-faction-name">{sfGroup.name}</span>
                                        <span className={`super-faction-access-badge ${accessCount === 0 ? 'none' :
                                            accessCount === totalCount ? 'all' : 'partial'
                                            }`}>
                                            {accessCount}/{totalCount}
                                        </span>
                                    </div>
                                    <div className="comparison-sectorials">
                                        {sfGroup.factions.map((faction, fIdx) => (
                                            <motion.div
                                                key={faction.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: sfIdx * 0.03 + fIdx * 0.01 }}
                                                className={`comparison-faction-card ${faction.hasAccess ? 'access' : 'denied'}`}
                                            >
                                                <div className="comparison-faction-header">
                                                    {faction.hasAccess ? (
                                                        <CheckCircle2 size={14} className="status-icon access" />
                                                    ) : (
                                                        <XCircle size={14} className="status-icon denied" />
                                                    )}
                                                    <span className="comparison-faction-name">{faction.name}</span>
                                                    {faction.hasAccess && (
                                                        <span className="comparison-unit-count">{faction.units.length}</span>
                                                    )}
                                                </div>
                                                {faction.hasAccess && faction.units.length > 0 && (
                                                    <ul className="faction-unit-list compact">
                                                        {faction.units.slice(0, 5).map(name => (
                                                            <li key={name} className="faction-unit-item">{name}</li>
                                                        ))}
                                                        {faction.units.length > 5 && (
                                                            <li className="faction-unit-item more">
                                                                +{faction.units.length - 5} more
                                                            </li>
                                                        )}
                                                    </ul>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <>
                    {/* Factions with Access */}
                    <section className="faction-section">
                        <div className="faction-section-header">
                            <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                            <h2 className="faction-section-title">Factions with Access</h2>
                            <span className="faction-section-count access">
                                {sortedAccessIds.length} factions
                            </span>
                        </div>

                        {viewMode === 'flat' ? (
                            <div className="faction-grid">
                                {sortedAccessIds.map((fid, idx) => {
                                    const factionUnits = Array.from(new Set(factionMap[fid].map(u => u.name))).sort();
                                    return (
                                        <motion.div
                                            key={fid}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className="faction-card"
                                        >
                                            <div className="faction-card-title">
                                                <span>{db.getFactionName(fid)}</span>
                                                <span className="count">{factionUnits.length}</span>
                                            </div>
                                            <ul className="faction-unit-list">
                                                {factionUnits.map(name => (
                                                    <li key={name} className="faction-unit-item">{name}</li>
                                                ))}
                                            </ul>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="super-faction-groups">
                                {groupedAccessFactions.map((sfGroup, sfIdx) => (
                                    <motion.div
                                        key={sfGroup.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: sfIdx * 0.03 }}
                                        className="super-faction-group"
                                    >
                                        <div className="super-faction-header">
                                            <span className="super-faction-name">{sfGroup.name}</span>
                                            <span className="super-faction-count">
                                                {sfGroup.factions.length} faction{sfGroup.factions.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div className="faction-grid nested">
                                            {sfGroup.factions.map((faction, fIdx) => (
                                                <motion.div
                                                    key={faction.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: sfIdx * 0.03 + fIdx * 0.01 }}
                                                    className="faction-card"
                                                >
                                                    <div className="faction-card-title">
                                                        <span>{faction.name}</span>
                                                        <span className="count">{faction.units.length}</span>
                                                    </div>
                                                    <ul className="faction-unit-list">
                                                        {faction.units.map(name => (
                                                            <li key={name} className="faction-unit-item">{name}</li>
                                                        ))}
                                                    </ul>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Factions without Access */}
                    {missingFactionIds.length > 0 && (
                        <section className="faction-section">
                            <div className="faction-section-header">
                                <XCircle size={20} style={{ color: 'var(--error)' }} />
                                <h2 className="faction-section-title">Factions without Access</h2>
                                <span className="faction-section-count denied">
                                    {missingFactionIds.length} factions
                                </span>
                            </div>

                            {viewMode === 'flat' ? (
                                <div className="denied-faction-grid">
                                    {missingFactionIds
                                        .sort((a, b) => db.getFactionName(a).localeCompare(db.getFactionName(b)))
                                        .map((fid, idx) => (
                                            <motion.div
                                                key={fid}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.1 + idx * 0.01 }}
                                                className="denied-faction-item"
                                            >
                                                {db.getFactionName(fid)}
                                            </motion.div>
                                        ))}
                                </div>
                            ) : (
                                <div className="super-faction-groups denied">
                                    {groupedMissingFactions.map((sfGroup, sfIdx) => (
                                        <motion.div
                                            key={sfGroup.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.1 + sfIdx * 0.02 }}
                                            className="super-faction-group denied"
                                        >
                                            <div className="super-faction-header denied">
                                                <span className="super-faction-name">{sfGroup.name}</span>
                                            </div>
                                            <div className="denied-faction-grid nested">
                                                {sfGroup.factions.map(faction => (
                                                    <div key={faction.id} className="denied-faction-item">
                                                        {faction.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}
                </>
            )}
        </div>
    );
};
