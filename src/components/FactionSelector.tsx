import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import type { SuperFaction, FactionInfo } from '@shared/types';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';

interface FactionSelectorProps {
    value: number | null;
    onChange: (factionId: number) => void;
    groupedFactions: SuperFaction[];
    placeholder?: string;
    filterFn?: (faction: FactionInfo) => boolean;
    className?: string;
}

/**
 * Faction dropdown with collapsible super-faction groups.
 * Uses Headless UI Listbox for accessibility, with local open/collapsed state per group.
 */
export function FactionSelector({
    value,
    onChange,
    groupedFactions,
    placeholder = '— Select Faction —',
    filterFn,
    className = ''
}: FactionSelectorProps) {
    // Track which super-faction groups are collapsed (all collapsed by default)
    const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(() => new Set(groupedFactions.map(g => g.id)));

    const toggleGroup = (groupId: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    // Flatten all available factions to look up the selected one
    const allAvailableFactions = useMemo(() => {
        const result: FactionInfo[] = [];
        groupedFactions.forEach(group => {
            const vanilla = group.vanilla && (!filterFn || filterFn(group.vanilla)) ? group.vanilla : null;
            const sectorials = filterFn ? group.sectorials.filter(filterFn) : group.sectorials;
            if (vanilla) result.push(vanilla);
            result.push(...sectorials);
        });
        return result;
    }, [groupedFactions, filterFn]);

    const selectedFaction = allAvailableFactions.find(f => f.id === value) || null;

    return (
        <div className={clsx('relative w-full', className)}>
            <Listbox value={value || 0} onChange={onChange}>
                {/* ── Trigger button ── */}
                <ListboxButton className="relative w-full cursor-default rounded-lg bg-gray-800 py-2 pl-3 pr-10 text-left border border-gray-600 shadow-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 text-sm text-gray-200 transition-colors hover:bg-gray-700 hover:border-gray-500">
                    <span className="flex items-center gap-2 min-h-[1.5rem] overflow-hidden">
                        {selectedFaction ? (
                            <>
                                <img
                                    src={`${import.meta.env.BASE_URL}${selectedFaction.logo.slice(1)}`}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    alt=""
                                    className="h-6 w-6 object-contain flex-shrink-0"
                                    aria-hidden="true"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-white leading-tight truncate pr-2">
                                        {selectedFaction.name}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                        {selectedFaction.isVanilla ? 'Vanilla Faction' : 'Sectorial'}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <span className="text-sm text-gray-500">{placeholder}</span>
                        )}
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    </span>
                </ListboxButton>

                {/* ── Dropdown panel — same width as button ── */}
                <ListboxOptions
                    transition
                    className="absolute z-50 mt-1 max-h-[28rem] w-full overflow-auto rounded-lg bg-gray-900 shadow-2xl ring-1 ring-black/30 focus:outline-none border border-gray-700 data-[closed]:data-[leave]:opacity-0 data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in"
                >
                    {groupedFactions.map(group => {
                        const vanilla = group.vanilla && (!filterFn || filterFn(group.vanilla)) ? group.vanilla : null;
                        const sectorials = filterFn ? group.sectorials.filter(filterFn) : group.sectorials;
                        if (!vanilla && sectorials.length === 0) return null;

                        const isCollapsed = collapsedGroups.has(group.id);
                        const headerLogo = vanilla?.logo || sectorials[0]?.logo;
                        const childCount = (vanilla ? 1 : 0) + sectorials.length;

                        return (
                            <div key={group.id} className="border-b border-gray-700/50 last:border-b-0">
                                {/* ── Super-faction header (clickable to collapse) ── */}
                                <button
                                    type="button"
                                    onClick={(e) => toggleGroup(group.id, e)}
                                    className="w-full sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 transition-colors border-b border-gray-700/40 text-left group"
                                >
                                    {headerLogo && (
                                        <img
                                            src={`${import.meta.env.BASE_URL}${headerLogo.slice(1)}`}
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            alt=""
                                            className="h-5 w-5 object-contain flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                                        />
                                    )}
                                    <span className="flex-1 text-xs font-bold text-gray-200 uppercase tracking-widest leading-none">
                                        {group.name}
                                    </span>
                                    <span className="text-[10px] text-gray-500 mr-1">{childCount}</span>
                                    {isCollapsed
                                        ? <ChevronRight className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                        : <ChevronDown className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                    }
                                </button>

                                {/* ── Options (shown when not collapsed) ── */}
                                {!isCollapsed && (
                                    <div>
                                        {/* Vanilla (full faction) */}
                                        {vanilla && (
                                            <ListboxOption
                                                value={vanilla.id}
                                                className="group relative cursor-default select-none py-1.5 px-3 text-gray-100 data-[focus]:bg-gray-700 data-[focus]:text-white transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <img
                                                        src={`${import.meta.env.BASE_URL}${vanilla.logo.slice(1)}`}
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        alt=""
                                                        className="h-6 w-6 flex-shrink-0 object-contain"
                                                    />
                                                    <div>
                                                        <div className="font-semibold text-sm leading-tight group-data-[selected]:text-white">
                                                            {vanilla.name}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">Vanilla</div>
                                                    </div>
                                                </div>
                                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-accent-500 hidden group-data-[selected]:flex">
                                                    <Check className="h-4 w-4" aria-hidden="true" />
                                                </span>
                                            </ListboxOption>
                                        )}

                                        {/* Sectorials */}
                                        {sectorials.map(s => (
                                            <ListboxOption
                                                key={s.id}
                                                value={s.id}
                                                className="group relative cursor-default select-none py-1.5 pl-7 pr-8 text-gray-300 data-[focus]:bg-gray-700 data-[focus]:text-white transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <img
                                                        src={`${import.meta.env.BASE_URL}${s.logo.slice(1)}`}
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        alt=""
                                                        className="h-5 w-5 flex-shrink-0 object-contain"
                                                    />
                                                    <div>
                                                        <div className="font-medium text-sm leading-tight group-data-[selected]:text-white group-data-[selected]:font-semibold">
                                                            {s.name}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">Sectorial</div>
                                                    </div>
                                                </div>
                                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-accent-500 hidden group-data-[selected]:flex">
                                                    <Check className="h-4 w-4" aria-hidden="true" />
                                                </span>
                                            </ListboxOption>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </ListboxOptions>
            </Listbox>
        </div>
    );
}
