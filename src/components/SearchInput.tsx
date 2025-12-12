import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    icon?: ReactNode;
    className?: string;
}

/**
 * Reusable search input component with icon.
 * Provides consistent search UI across pages.
 */
export function SearchInput({
    value,
    onChange,
    placeholder = 'Search...',
    icon,
    className = ''
}: SearchInputProps) {
    return (
        <div className={`search-wrapper ${className}`}>
            <span className="search-icon">
                {icon || <Search size={16} />}
            </span>
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="search-input"
            />
        </div>
    );
}
