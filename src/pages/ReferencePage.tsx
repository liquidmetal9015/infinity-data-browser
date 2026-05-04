import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { useDatabase } from '../hooks/useDatabase';
import { Search, ExternalLink, Shield, Zap, Crosshair, Atom } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import styles from './ReferencePage.module.css';

type ItemType = 'skill' | 'weapon' | 'equipment';

interface ReferenceRow {
    id: string; // Unique key for the row (type-id-mods)
    baseId: number;
    name: string;
    displayName: string;
    type: ItemType;
    count: number;
    examples: string[]; // List of unit names
    wiki?: string;
    modifiers: string[];
}

export function ReferencePage() {
    const db = useDatabase();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<'name' | 'count' | 'type'>('name');
    const [sortDesc, setSortDesc] = useState(false);
    const [showModifiers, setShowModifiers] = useState(true);

    // Aggregate all rows (expensive — only reruns when db or modifier toggle changes)

    const allRows = useMemo(() => {
        const rows = new Map<string, ReferenceRow>();

        db.units.forEach(unit => {
            unit.allItemsWithMods.forEach(item => {
                const modKey = showModifiers ? item.modifiers.sort().join(',') : '';
                const key = `${item.type}-${item.id}-[${modKey}]`;

                if (!rows.has(key)) {
                    let wiki: string | undefined;
                    if (item.type === 'skill') wiki = db.metadata?.skills.find(s => s.id === item.id)?.wiki;
                    else if (item.type === 'weapon') wiki = db.metadata?.weapons.find(w => w.id === item.id)?.wiki;
                    else if (item.type === 'equipment') wiki = db.metadata?.equips.find(e => e.id === item.id)?.wiki;

                    let displayName = item.name;
                    if (showModifiers && item.modifiers.length > 0) {
                        displayName = `${item.name} (${item.modifiers.join(', ')})`;
                    }

                    rows.set(key, {
                        id: key,
                        baseId: item.id,
                        name: item.name,
                        displayName,
                        type: item.type,
                        count: 0,
                        examples: [],
                        wiki,
                        modifiers: item.modifiers
                    });
                }

                const row = rows.get(key)!;
                row.count++;
                if (row.examples.length < 5 && !row.examples.includes(unit.name)) {
                    row.examples.push(unit.name);
                }
            });
        });

        return Array.from(rows.values());
    }, [db.units, db.metadata, showModifiers]);

    // Filter and sort (cheap — reruns on search/sort changes without rebuilding full dataset)
    const data = useMemo(() => {
        const lowerSearch = search.toLowerCase();
        return allRows
            .filter(row =>
                !lowerSearch ||
                row.displayName.toLowerCase().includes(lowerSearch) ||
                row.type.toLowerCase().includes(lowerSearch)
            )
            .sort((a, b) => {
                const modifier = sortDesc ? -1 : 1;
                if (sortField === 'count') return (a.count - b.count) * modifier;
                if (sortField === 'type') return a.type.localeCompare(b.type) * modifier;
                return a.displayName.localeCompare(b.displayName) * modifier;
            });
    }, [allRows, search, sortField, sortDesc]);


    const navigateToSearch = (row: ReferenceRow) => {
        const params = new URLSearchParams({
            filterType: row.type,
            filterName: row.name,
            filterId: String(row.baseId),
        });
        if (row.modifiers.length > 0) {
            params.set('filterModifiers', row.modifiers.join(','));
        }
        navigate(`/search?${params.toString()}`);
    };

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDesc(!sortDesc);
        } else {
            setSortField(field);
            setSortDesc(false);
        }
    };

    const getTypeIcon = (type: ItemType) => {
        switch (type) {
            case 'skill': return <Zap size={16} />;
            case 'weapon': return <Crosshair size={16} />;
            case 'equipment': return <Shield size={16} />;
            default: return <Atom size={16} />;
        }
    };

    const getTypeColor = (type: ItemType) => {
        switch (type) {
            case 'skill': return 'var(--color-info, #3b82f6)';
            case 'weapon': return 'var(--color-danger, #ef4444)';
            case 'equipment': return 'var(--color-success, #22c55e)';
            default: return 'var(--text-secondary)';
        }
    };

    return (
        <div className={clsx('page-container', styles.referencePage)}>
            <div className={styles.pageHeader}>
                <div className={styles.searchWrapper}>
                    <Search className={styles.searchIcon} size={24} />
                    <input
                        type="text"
                        placeholder="Search reference library..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.toggleWrapper}>
                    <button
                        className={clsx(styles.toggleBtn, showModifiers && styles.active)}
                        onClick={() => setShowModifiers(true)}
                    >
                        With Modifiers
                    </button>
                    <button
                        className={clsx(styles.toggleBtn, !showModifiers && styles.active)}
                        onClick={() => setShowModifiers(false)}
                    >
                        Without Modifiers
                    </button>
                </div>
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.referenceTable}>
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('type')} className={clsx(styles.typeCol, styles.sortable)}>
                                Type {sortField === 'type' && (sortDesc ? '↓' : '↑')}
                            </th>
                            <th onClick={() => handleSort('name')} className={clsx(styles.nameCol, styles.sortable)}>
                                Name {sortField === 'name' && (sortDesc ? '↓' : '↑')}
                            </th>
                            <th onClick={() => handleSort('count')} className={clsx(styles.countCol, styles.sortable)}>
                                Count {sortField === 'count' && (sortDesc ? '↓' : '↑')}
                            </th>
                            <th className={styles.examplesCol}>Example Units</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => (
                            <motion.tr
                                key={row.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={`row-${row.type}`}
                            >
                                <td className={styles.typeCell} data-label="Type">
                                    <span
                                        className={styles.typeBadge}
                                        style={{
                                            color: getTypeColor(row.type),
                                            borderColor: getTypeColor(row.type),
                                            background: `${getTypeColor(row.type)}1A` // 10% opacity
                                        }}
                                    >
                                        {getTypeIcon(row.type)}
                                        {row.type}
                                    </span>
                                </td>
                                <td className={styles.nameCell} data-label="Name">
                                    <div className={styles.nameWrapper}>
                                        <span className={styles.entryName}>{row.displayName}</span>
                                        {row.wiki && (
                                            <a
                                                href={row.wiki}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.wikiLink}
                                                title="Open Wiki"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                    </div>
                                </td>
                                <td className={styles.countCell} data-label="Count">
                                    <button
                                        className={styles.countBtn}
                                        onClick={() => navigateToSearch(row)}
                                        title="See all units with this item"
                                    >
                                        {row.count} units →
                                    </button>
                                </td>
                                <td className={styles.examplesCell} data-label="Examples">
                                    <div className={styles.examplesList}>
                                        {row.examples.map((ex, i) => (
                                            <span key={i} className={styles.exampleTag}>{ex}</span>
                                        ))}
                                        {row.count > 5 && <span className={styles.moreTag}>+{row.count - 5} more</span>}
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
                {data.length === 0 && (
                    <div className={styles.emptyState}>No entries found matching your search.</div>
                )}
            </div>
        </div>
    );
}
