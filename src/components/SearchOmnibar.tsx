import React, { useState, useEffect } from 'react';
import { PenTool, Cpu, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../utils';

interface SearchOmnibarProps {
    search: { weapon: string; skill: string; equip: string };
    setSearch: React.Dispatch<React.SetStateAction<{ weapon: string; skill: string; equip: string }>>;
}

export const SearchOmnibar: React.FC<SearchOmnibarProps> = ({ search, setSearch }) => {
    // Local state for immediate input feedback (no lag while typing)
    const [localSearch, setLocalSearch] = useState(search);

    // Debounce: only update parent state after 300ms of no typing
    useEffect(() => {
        const timer = setTimeout(() => {
            // Only update if values actually changed
            if (
                localSearch.weapon !== search.weapon ||
                localSearch.skill !== search.skill ||
                localSearch.equip !== search.equip
            ) {
                setSearch(localSearch);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [localSearch, search, setSearch]);

    // Sync local state if parent changes (e.g., clearing search externally)
    useEffect(() => {
        setLocalSearch(search);
    }, [search]);

    const handleChange = (field: keyof typeof search, value: string) => {
        setLocalSearch(prev => ({ ...prev, [field]: value }));
    };

    const InputField = ({
        icon: Icon,
        placeholder,
        value,
        field,
        colorClass
    }: {
        icon: React.ElementType,
        placeholder: string,
        value: string,
        field: keyof typeof search,
        colorClass: string
    }) => (
        <div className="relative group flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-white transition-colors">
                <Icon size={16} />
            </div>
            <input
                type="text"
                value={value}
                onChange={(e) => handleChange(field, e.target.value)}
                className={cn(
                    "block w-full pl-10 pr-3 py-3 bg-cyber-panel/50 border border-cyber-border rounded-lg",
                    "text-sm text-cyber-text placeholder-cyber-muted focus:outline-none focus:ring-1 focus:bg-cyber-bg/80 transition-all",
                    colorClass
                )}
                placeholder={placeholder}
            />
        </div>
    );

    return (
        <div className="w-full max-w-4xl mx-auto mb-8">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-20"
            >
                {/* Main Bar */}
                <div className="flex flex-col md:flex-row gap-4 p-4 bg-cyber-bg/80 backdrop-blur-md border border-cyber-border/50 rounded-xl shadow-2xl">
                    <InputField
                        icon={Zap}
                        placeholder="Search Weapon..."
                        value={localSearch.weapon}
                        field="weapon"
                        colorClass="focus:border-cyber-primary focus:ring-cyber-primary"
                    />
                    <InputField
                        icon={Cpu}
                        placeholder="Search Equipment..."
                        value={localSearch.equip}
                        field="equip"
                        colorClass="focus:border-cyber-accent focus:ring-cyber-accent"
                    />
                    <InputField
                        icon={PenTool}
                        placeholder="Search Skill..."
                        value={localSearch.skill}
                        field="skill"
                        colorClass="focus:border-yellow-500 focus:ring-yellow-500"
                    />
                </div>

                {/* Decoration */}
                <div className="absolute -inset-1 bg-gradient-to-r from-cyber-primary/20 via-cyber-accent/20 to-cyber-primary/20 rounded-xl blur opacity-30 -z-10"></div>
            </motion.div>
        </div>
    );
};
