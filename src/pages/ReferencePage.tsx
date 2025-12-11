import { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Search, ExternalLink, Shield, Zap, Crosshair, Atom } from 'lucide-react';
import { motion } from 'framer-motion';

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
    modifiers: number[];
}

export function ReferencePage() {
    const db = useDatabase();
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<'name' | 'count' | 'type'>('name');
    const [sortDesc, setSortDesc] = useState(false);

    // Aggregate data
    const data = useMemo(() => {
        const rows = new Map<string, ReferenceRow>();

        db.units.forEach(unit => {
            unit.allItemsWithMods.forEach(item => {
                // Generate a unique key for this configuration
                const modKey = item.modifiers.sort().join(',');
                const key = `${item.type}-${item.id}-[${modKey}]`;

                if (!rows.has(key)) {
                    // Get wiki link if available from metadata
                    let wiki: string | undefined;
                    if (item.type === 'skill') wiki = db.metadata?.skills.find(s => s.id === item.id)?.wiki;
                    else if (item.type === 'weapon') wiki = db.metadata?.weapons.find(w => w.id === item.id)?.wiki;
                    else if (item.type === 'equipment') wiki = db.metadata?.equips.find(e => e.id === item.id)?.wiki;
                    // Note: ammunition is not currently in allItemsWithMods, might need separate handling if requested

                    // Format Display Name
                    let displayName = item.name;
                    if (item.modifiers.length > 0) {
                        const modString = item.modifiers.map(m => {
                            const val = db.extrasMap.get(m);
                            return val ? `(${val})` : ``;
                        }).join(' ');
                        displayName = `${item.name} ${modString}`;
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
                // Keep unique examples, capped at 5
                if (row.examples.length < 5 && !row.examples.includes(unit.name)) {
                    row.examples.push(unit.name);
                }
            });
        });

        // Convert to array and filter
        return Array.from(rows.values())
            .filter(row =>
                row.displayName.toLowerCase().includes(search.toLowerCase()) ||
                row.type.toLowerCase().includes(search.toLowerCase())
            )
            .sort((a, b) => {
                const modifier = sortDesc ? -1 : 1;
                if (sortField === 'count') return (a.count - b.count) * modifier;
                if (sortField === 'type') return a.type.localeCompare(b.type) * modifier;
                return a.displayName.localeCompare(b.displayName) * modifier;
            });
    }, [db.units, db.metadata, db.extrasMap, search, sortField, sortDesc]);


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
        <div className="page-container reference-page">
            <div className="page-header">
                <h2>Reference Library</h2>
                <div className="search-wrapper">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Search entries..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="table-container">
                <table className="reference-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('type')} className="type-col sortable">
                                Type {sortField === 'type' && (sortDesc ? '↓' : '↑')}
                            </th>
                            <th onClick={() => handleSort('name')} className="name-col sortable">
                                Name {sortField === 'name' && (sortDesc ? '↓' : '↑')}
                            </th>
                            <th onClick={() => handleSort('count')} className="count-col sortable">
                                Count {sortField === 'count' && (sortDesc ? '↓' : '↑')}
                            </th>
                            <th className="examples-col">Example Units</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => (
                            <motion.tr
                                key={row.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                layout
                                className={`row-${row.type}`}
                            >
                                <td className="type-cell">
                                    <span
                                        className="type-badge"
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
                                <td className="name-cell">
                                    <div className="name-wrapper">
                                        <span className="entry-name">{row.displayName}</span>
                                        {row.wiki && (
                                            <a
                                                href={row.wiki}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="wiki-link"
                                                title="Open Wiki"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                    </div>
                                </td>
                                <td className="count-cell">
                                    <span className="count-badge">{row.count}</span>
                                </td>
                                <td className="examples-cell">
                                    <div className="examples-list">
                                        {row.examples.map((ex, i) => (
                                            <span key={i} className="example-tag">{ex}</span>
                                        ))}
                                        {row.count > 5 && <span className="more-tag">+{row.count - 5} more</span>}
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
                {data.length === 0 && (
                    <div className="empty-state">No entries found matching your search.</div>
                )}
            </div>

            <style>{`
                .reference-page {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 2rem;
                }
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }
                .page-header h2 {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }
                .search-wrapper {
                    position: relative;
                    width: 300px;
                }
                .search-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-secondary);
                }
                .search-input {
                    width: 100%;
                    padding: 0.75rem 1rem 0.75rem 2.5rem;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                }

                .table-container {
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    overflow: hidden;
                }
                .reference-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }
                .reference-table th {
                    padding: 1rem;
                    background: var(--bg-primary);
                    border-bottom: 1px solid var(--border-color);
                    color: var(--text-secondary);
                    font-weight: 600;
                    user-select: none;
                }
                .reference-table th.sortable {
                    cursor: pointer;
                }
                .reference-table th.sortable:hover {
                    color: var(--text-primary);
                }
                .reference-table td {
                    padding: 0.75rem 1rem;
                    border-bottom: 1px solid var(--border-color);
                    color: var(--text-primary);
                }
                .reference-table tr:last-child td {
                    border-bottom: none;
                }
                .reference-table tr:hover {
                    background: var(--bg-hover);
                }

                /* Type Column */
                .type-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.25rem 0.6rem;
                    border-radius: 100px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    border: 1px solid;
                }

                /* Name Column */
                .name-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .entry-name {
                    font-weight: 500;
                }
                .wiki-link {
                    color: var(--text-secondary);
                    opacity: 0.5;
                    transition: all 0.2s;
                }
                .wiki-link:hover {
                    color: var(--color-primary);
                    opacity: 1;
                }

                /* Count Column */
                .count-badge {
                    background: var(--bg-primary);
                    padding: 0.2rem 0.6rem;
                    border-radius: 4px;
                    font-size: 0.9rem;
                    font-family: monospace;
                    border: 1px solid var(--border-color);
                }

                /* Examples Column */
                .examples-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.4rem;
                }
                .example-tag {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    background: var(--bg-primary);
                    padding: 0.1rem 0.4rem;
                    border-radius: 4px;
                    border: 1px solid var(--border-color);
                }
                .more-tag {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    font-style: italic;
                    margin-left: 0.2rem;
                }

                .empty-state {
                    padding: 3rem;
                    text-align: center;
                    color: var(--text-secondary);
                }
            `}</style>
        </div>
    );
}
