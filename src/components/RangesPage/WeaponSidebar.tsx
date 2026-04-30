// Weapon Selection Sidebar Component
import { Search, Info } from 'lucide-react';
import { clsx } from 'clsx';
import type { ParsedWeapon } from './types';
import type { Unit } from '@shared/types';
import styles from '../../pages/RangesPage.module.css';

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
        <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
                <h2>Range Visualizer</h2>

                {/* Unit Search */}
                <div className={styles.unitSearchSection}>
                    <div className={styles.searchWrapper}>
                        <Search className={styles.searchIcon} size={16} />
                        <input
                            type="text"
                            placeholder="Load unit weapons..."
                            value={unitSearch}
                            onChange={(e) => setUnitSearch(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                    {/* Autocomplete Dropdown */}
                    {filteredUnits.length > 0 && (
                        <div className={styles.autocompleteDropdown}>
                            {filteredUnits.map(u => (
                                <div
                                    key={u.id}
                                    className={styles.autocompleteItem}
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

                <div className={styles.divider}>or filter details</div>

                <div className={styles.searchWrapper}>
                    <Search className={styles.searchIcon} size={16} />
                    <input
                        type="text"
                        placeholder="Filter list..."
                        value={weaponSearch}
                        onChange={(e) => setWeaponSearch(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>
            </div>
            <div className={styles.weaponList}>
                {filteredWeapons.map(w => (
                    <div
                        key={w.id}
                        className={clsx(styles.weaponItem, selectedIds.has(w.id) && styles.selected)}
                        onClick={() => onToggleWeapon(w.id)}
                    >
                        <span>{w.name}</span>
                    </div>
                ))}
                {filteredWeapons.length === 0 && (
                    <div className={styles.emptyMsg}>No weapons found</div>
                )}
            </div>
        </div>
    );
}
