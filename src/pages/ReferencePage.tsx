import { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Search, ExternalLink, BookOpen, Shield, Zap, Crosshair } from 'lucide-react';
import { motion } from 'framer-motion';

type Tab = 'skills' | 'weapons' | 'equipment' | 'ammunition';

export function ReferencePage() {
    const db = useDatabase();
    const [activeTab, setActiveTab] = useState<Tab>('skills');
    const [search, setSearch] = useState('');

    // Pre-compute usage counts
    const usageCounts = useMemo(() => {
        const counts = {
            skills: new Map<number, number>(),
            weapons: new Map<number, number>(),
            equipment: new Map<number, number>()
        };

        db.units.forEach(unit => {
            unit.allSkillIds.forEach(id => counts.skills.set(id, (counts.skills.get(id) || 0) + 1));
            unit.allWeaponIds.forEach(id => counts.weapons.set(id, (counts.weapons.get(id) || 0) + 1));
            unit.allEquipmentIds.forEach(id => counts.equipment.set(id, (counts.equipment.get(id) || 0) + 1));
        });

        return counts;
    }, [db.units]);

    const tabs = [
        { id: 'skills', label: 'Skills', icon: Zap },
        { id: 'weapons', label: 'Weapons', icon: Crosshair },
        { id: 'equipment', label: 'Equipment', icon: Shield },
        { id: 'ammunition', label: 'Ammunition', icon: BookOpen },
    ] as const;

    const data = useMemo(() => {
        if (!db.metadata) return [];
        let source: { id: number; name: string; wiki?: string }[] = [];
        let counts: Map<number, number> | undefined;

        switch (activeTab) {
            case 'skills':
                source = db.metadata.skills;
                counts = usageCounts.skills;
                break;
            case 'weapons':
                source = db.metadata.weapons;
                counts = usageCounts.weapons;
                break;
            case 'equipment':
                source = db.metadata.equips;
                counts = usageCounts.equipment;
                break;
            case 'ammunition':
                source = db.metadata.ammunitions || [];
                break;
        }

        // Deduplicate using Map
        const uniqueItems = new Map<number, typeof source[0]>();
        source.forEach(item => {
            if (!uniqueItems.has(item.id)) {
                uniqueItems.set(item.id, item);
            }
        });

        return Array.from(uniqueItems.values())
            .filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
            .map(item => ({
                ...item,
                count: counts?.get(item.id) || 0
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db.metadata, activeTab, search, usageCounts]);

    return (
        <div className="page-container reference-page">
            <div className="page-header">
                <h2>Reference Library</h2>
                <div className="search-wrapper">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="reference-list">
                {data.map((item) => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="reference-card"
                    >
                        <div className="card-header">
                            <h3>{item.name}</h3>
                            {item.wiki && (
                                <a
                                    href={item.wiki}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="wiki-link"
                                    title="Open Wiki"
                                >
                                    <ExternalLink size={16} />
                                </a>
                            )}
                        </div>
                        {activeTab !== 'ammunition' && (
                            <div className="usage-stat">
                                Used by {item.count} units
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            <style>{`
                .reference-page {
                    max-width: 1200px;
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
                .tabs {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 2rem;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 1rem;
                }
                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                    border: 1px solid transparent;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 500;
                }
                .tab-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }
                .tab-btn.active {
                    background: rgba(var(--color-primary-rgb), 0.1);
                    color: var(--color-primary);
                    border-color: rgba(var(--color-primary-rgb), 0.2);
                }
                .reference-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1rem;
                }
                .reference-card {
                    background: var(--bg-secondary);
                    padding: 1.25rem;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .reference-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    border-color: var(--color-primary);
                }
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 0.5rem;
                    margin-bottom: 0.5rem;
                }
                .card-header h3 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }
                .wiki-link {
                    color: var(--text-secondary);
                    transition: color 0.2s;
                    flex-shrink: 0;
                }
                .wiki-link:hover {
                    color: var(--color-primary);
                }
                .usage-stat {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                }
            `}</style>
        </div>
    );
}
