// Weapon Selection Sidebar Component
import { Search, Info } from 'lucide-react';
import type { ParsedWeapon } from './types';
import type { Unit } from '../../types';

interface WeaponSidebarProps {
    weaponSearch: string;
    setWeaponSearch: (search: string) => void;
    unitSearch: string;
    setUnitSearch: (search: string) => void;
    filteredWeapons: ParsedWeapon[];
    filteredUnits: Unit[];
    selectedIds: Set<number>;
    onToggleWeapon: (id: number) => void;
    onSelectUnitWeapons: (unitId: number) => void;
    onViewUnit: (unit: Unit) => void;
}

export function WeaponSidebar({
    weaponSearch,
    setWeaponSearch,
    unitSearch,
    setUnitSearch,
    filteredWeapons,
    filteredUnits,
    selectedIds,
    onToggleWeapon,
    onSelectUnitWeapons,
    onViewUnit
}: WeaponSidebarProps) {
    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h2>Range Visualizer</h2>

                {/* Unit Search */}
                <div className="unit-search-section">
                    <div className="search-wrapper">
                        <Search className="search-icon" size={16} />
                        <input
                            type="text"
                            placeholder="Load unit weapons..."
                            value={unitSearch}
                            onChange={(e) => setUnitSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    {/* Autocomplete Dropdown */}
                    {filteredUnits.length > 0 && (
                        <div className="autocomplete-dropdown">
                            {filteredUnits.map(u => (
                                <div
                                    key={u.id}
                                    className="autocomplete-item"
                                    onClick={() => onSelectUnitWeapons(u.id)}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                >
                                    <span style={{ flex: 1 }}>{u.name}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewUnit(u);
                                        }}
                                        className="hover:text-cyber-primary p-1"
                                        title="View Unit Stats"
                                    >
                                        <Info size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="divider">or filter details</div>

                <div className="search-wrapper">
                    <Search className="search-icon" size={16} />
                    <input
                        type="text"
                        placeholder="Filter list..."
                        value={weaponSearch}
                        onChange={(e) => setWeaponSearch(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>
            <div className="weapon-list">
                {filteredWeapons.map(w => (
                    <div
                        key={w.id}
                        className={`weapon-item ${selectedIds.has(w.id) ? 'selected' : ''}`}
                        onClick={() => onToggleWeapon(w.id)}
                    >
                        <span className="weapon-name">{w.name}</span>
                    </div>
                ))}
                {filteredWeapons.length === 0 && (
                    <div className="empty-msg">No weapons found</div>
                )}
            </div>
        </div>
    );
}
