import { useState, useMemo, useRef, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import type { Unit } from '../../../shared/types';
import { Search } from 'lucide-react';
import styles from './CalculatorUnitSelector.module.css';

interface CalculatorUnitSelectorProps {
    onSelect: (unit: Unit) => void;
    placeholder?: string;
    onClear?: () => void;
}

export function CalculatorUnitSelector({ onSelect, onClear, placeholder = 'Search Unit...' }: CalculatorUnitSelectorProps) {
    const db = useDatabase();
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Initialize units if not ready
    useEffect(() => {
        if (db.units.length === 0) {
            // Units are loaded from context, but we can ensure they are available
        }
    }, [db.units.length]);

    const filteredUnits = useMemo(() => {
        if (!searchTerm.trim()) return [];

        const term = searchTerm.toLowerCase();
        return db.units
            .filter(u =>
                (u.name?.toLowerCase().includes(term) || u.isc?.toLowerCase().includes(term))
            )
            .slice(0, 10); // Limit to 10 results for dropdown
    }, [searchTerm, db.units]);

    // Handle clicking outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (unit: Unit) => {
        onSelect(unit);
        setSearchTerm(''); // Clear text so it acts purely as a selector
        setIsOpen(false);
    };

    return (
        <div className={styles.calculatorUnitSelector} ref={wrapperRef}>
            <div className={styles.searchInputWrapper}>
                <Search size={16} className={styles.searchIcon} />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                        if (e.target.value === '' && onClear) {
                            onClear();
                        }
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    className={styles.unitSearchInput}
                />
            </div>

            {isOpen && filteredUnits.length > 0 && (
                <div className={styles.unitDropdown}>
                    {filteredUnits.map(unit => (
                        <div
                            key={unit.id}
                            className={styles.unitDropdownItem}
                            onClick={() => handleSelect(unit)}
                        >
                            <span className={styles.unitName}>{unit.isc || unit.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
