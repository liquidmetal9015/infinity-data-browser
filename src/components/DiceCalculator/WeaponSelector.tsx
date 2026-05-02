import { useState, useMemo, useRef, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { Search, ChevronDown } from 'lucide-react';
import type { ParsedWeapon } from '../../../shared/types';
import type { WeaponProfile } from './types';
import styles from './WeaponSelector.module.css';

interface WeaponSelectorProps {
    onSelect: (weapon: ParsedWeapon, profile: WeaponProfile) => void;
    placeholder?: string;
    filterOptionIds?: number[];
    disabled?: boolean;
}

export function WeaponSelector({ onSelect, placeholder = "Search weapons...", filterOptionIds, disabled = false }: WeaponSelectorProps) {
    const db = useDatabase();
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Get unique weapons
    const allWeapons = useMemo(() => {
        if (!db.metadata) return [];
        const unique = new Map<number, ParsedWeapon>();
        db.metadata.weapons.forEach(w => {
            if (filterOptionIds && !filterOptionIds.includes(w.id)) return;
            if (!unique.has(w.id)) {
                const details = db.getWeaponDetails(w.id);
                if (details) unique.set(w.id, details);
            }
        });
        return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [db, filterOptionIds]);

    // Filter by search
    const filteredWeapons = useMemo(() => {
        if (!search.trim()) return allWeapons.slice(0, 50); // Show some defaults if empty
        const q = search.toLowerCase();
        return allWeapons.filter(w => w.name.toLowerCase().includes(q)).slice(0, 50);
    }, [allWeapons, search]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (weapon: ParsedWeapon, profile: WeaponProfile) => {
        onSelect(weapon, profile);
        setSearch(''); // Clear search on select or keep it? Let's clear so it's ready for next
        setIsOpen(false);
    };

    return (
        <div className={styles.weaponSelector} ref={wrapperRef}>
            <div className={styles.searchInputWrapper}>
                <Search className={styles.searchIcon} size={16} />
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder={placeholder}
                    value={search}
                    onChange={e => {
                        if (disabled) return;
                        setSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => !disabled && setIsOpen(true)}
                    disabled={disabled}
                />
                <ChevronDown className={styles.dropdownIcon} size={16} />
            </div>

            {isOpen && (
                <div className={styles.dropdownMenu}>
                    {filteredWeapons.length === 0 ? (
                        <div className={styles.noResults}>No weapons found</div>
                    ) : (
                        filteredWeapons.map(weapon => {
                            const mockProfile: WeaponProfile = {
                                burst: parseInt(weapon.burst) || 1,
                                damage: weapon.damage || '-',
                                ammo: [weapon.ammunition || '-'],
                                bands: weapon.bands || []
                            };

                            return (
                                <button
                                    key={weapon.id}
                                    className={styles.weaponRowBtn}
                                    onClick={() => handleSelect(weapon, mockProfile)}
                                >
                                    {weapon.name}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
