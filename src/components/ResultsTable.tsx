import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Settings, Eye, EyeOff } from 'lucide-react';
import { Database } from '../services/Database';
import { UnitLink } from './UnitLink';
import type { Unit } from '../types';
import type { QueryState } from './QueryBuilder';

interface ResultsTableProps {
    units: Unit[];
    query: QueryState;
}

type SortField = 'name' | 'factions';
type SortDirection = 'asc' | 'desc';

interface ColumnConfig {
    id: string;
    label: string;
    visible: boolean;
    sortable: boolean;
    sortField?: SortField;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ units, query }) => {
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [showColumnSettings, setShowColumnSettings] = useState(false);
    const [columns, setColumns] = useState<ColumnConfig[]>([
        { id: 'name', label: 'Unit Name', visible: true, sortable: true, sortField: 'name' },
        { id: 'factions', label: 'Factions', visible: true, sortable: true, sortField: 'factions' },
        { id: 'match', label: 'Match', visible: false, sortable: false },  // Hidden by default
    ]);

    const db = Database.getInstance();

    // Sort units
    const sortedUnits = useMemo(() => {
        return [...units].sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'factions':
                    comparison = a.factions.length - b.factions.length;
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [units, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const toggleColumn = (columnId: string) => {
        setColumns(prev => prev.map(col =>
            col.id === columnId ? { ...col, visible: !col.visible } : col
        ));
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return <ChevronsUpDown size={14} className="sort-icon inactive" />;
        }
        return sortDirection === 'asc'
            ? <ChevronUp size={14} className="sort-icon active" />
            : <ChevronDown size={14} className="sort-icon active" />;
    };

    // Get matched items for a unit based on the current query
    const getMatchedItems = (unit: Unit): string[] => {
        const matches: string[] = [];

        for (const filter of query.filters) {
            for (const item of unit.allItemsWithMods) {
                if (item.type !== filter.type || item.id !== filter.baseId) continue;

                // Check if this item matches the filter
                const matchesFilter = filter.matchAnyModifier ||
                    (filter.modifiers.length === item.modifiers.length &&
                        filter.modifiers.every((m, i) => item.modifiers[i] === m));

                if (matchesFilter) {
                    // Format the display name with modifiers
                    let displayName = item.name;
                    if (item.modifiers.length > 0) {
                        const modStrings = item.modifiers.map(modId => {
                            const modName = db.getExtraName(modId);
                            return modName ? `(${modName})` : `(${modId})`;
                        });
                        displayName += modStrings.join(' ');
                    }
                    if (!matches.includes(displayName)) {
                        matches.push(displayName);
                    }
                }
            }
        }

        return matches;
    };

    const visibleColumns = columns.filter(c => c.visible);

    return (
        <div className="results-table-wrapper">
            {/* Column Settings Button */}
            <div className="table-controls">
                <div className="column-settings-wrapper">
                    <button
                        className="column-settings-btn"
                        onClick={() => setShowColumnSettings(!showColumnSettings)}
                        title="Configure columns"
                    >
                        <Settings size={14} />
                        Columns
                    </button>
                    {showColumnSettings && (
                        <div className="column-settings-dropdown">
                            {columns.map(col => (
                                <label key={col.id} className="column-toggle">
                                    <input
                                        type="checkbox"
                                        checked={col.visible}
                                        onChange={() => toggleColumn(col.id)}
                                    />
                                    {col.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                    <span>{col.label}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="results-table-container">
                <table className="results-table">
                    <thead>
                        <tr>
                            {visibleColumns.map(col => (
                                <th
                                    key={col.id}
                                    className={`th-${col.id}`}
                                    onClick={() => col.sortField && handleSort(col.sortField)}
                                    style={{ cursor: col.sortable ? 'pointer' : 'default' }}
                                >
                                    <span>{col.label}</span>
                                    {col.sortField && <SortIcon field={col.sortField} />}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedUnits.map((unit, idx) => {
                            // Get all valid factions with short names
                            const factionNames = unit.factions
                                .filter(fid => db.factionHasData(fid))
                                .map(fid => db.getFactionShortName(fid));
                            const uniqueFactions = [...new Set(factionNames)];

                            // Get matched items for this unit
                            const matchedItems = getMatchedItems(unit);

                            return (
                                <tr key={`${unit.isc}-${idx}`}>
                                    {visibleColumns.map(col => {
                                        switch (col.id) {
                                            case 'name':
                                                return <td key={col.id}><UnitLink name={unit.name} className="hover:text-cyber-primary font-medium" /></td>;
                                            case 'factions':
                                                return (
                                                    <td key={col.id} className="td-factions">
                                                        {uniqueFactions.map((name, i) => (
                                                            <span key={i} className="faction-tag">{name}</span>
                                                        ))}
                                                    </td>
                                                );
                                            case 'match':
                                                return (
                                                    <td key={col.id} className="td-match">
                                                        {matchedItems.slice(0, 3).map((item, i) => (
                                                            <span key={i} className="match-tag">{item}</span>
                                                        ))}
                                                        {matchedItems.length > 3 && (
                                                            <span className="match-more">+{matchedItems.length - 3}</span>
                                                        )}
                                                    </td>
                                                );
                                            default:
                                                return null;
                                        }
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
