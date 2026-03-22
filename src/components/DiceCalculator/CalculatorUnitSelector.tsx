import { useState, useMemo, useRef, useEffect } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import type { Unit } from '../../../shared/types';
import { Search } from 'lucide-react';
import './CalculatorUnitSelector.css';

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
        <div className="calculator-unit-selector" ref={wrapperRef}>
            <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
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
                    className="unit-search-input"
                />
            </div>

            {isOpen && filteredUnits.length > 0 && (
                <div className="unit-dropdown">
                    {filteredUnits.map(unit => (
                        <div
                            key={unit.id}
                            className="unit-dropdown-item"
                            onClick={() => handleSelect(unit)}
                        >
                            <span className="unit-name">{unit.isc || unit.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
