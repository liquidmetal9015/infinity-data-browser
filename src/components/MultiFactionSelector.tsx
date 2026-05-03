import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import type { SuperFaction, FactionInfo } from '@shared/types';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { getSafeLogo } from '../utils/assets';

interface MultiFactionSelectorProps {
    value: number[];
    onChange: (factionIds: number[]) => void;
    groupedFactions: SuperFaction[];
    placeholder?: string;
    filterFn?: (faction: FactionInfo) => boolean;
    className?: string;
}

/**
 * Multi-select faction dropdown with collapsible super-faction groups.
 */
export function MultiFactionSelector({
    value,
    onChange,
    groupedFactions,
    placeholder = '— Select Factions —',
    filterFn,
    className = ''
}: MultiFactionSelectorProps) {
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

    const selectedFactions = allAvailableFactions.filter(f => value.includes(f.id));

    // Deselect a single faction from the trigger button area
    const requestRemove = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(value.filter(v => v !== id));
    };

    return (
        <div className={clsx('relative w-full', className)}>
            <Listbox value={value} onChange={onChange} multiple>
                {/* ── Trigger button ── */}
                <ListboxButton className="relative w-full cursor-default rounded-lg bg-gray-800 py-2 pl-3 pr-10 text-left border border-gray-600 shadow-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 text-sm text-gray-200 transition-colors hover:bg-gray-700 hover:border-gray-500">
                    <span className="flex items-center gap-1.5 min-h-[1.5rem] overflow-hidden flex-wrap pr-2">
                        {selectedFactions.length > 0 ? (
                            selectedFactions.map(f => {
                                const logoSrc = getSafeLogo(f.logo);
                                return (
                                    <span
                                        key={f.id}
                                        className="inline-flex items-center gap-1 bg-gray-900 border border-gray-700 rounded pl-1.5 pr-0.5 py-0.5 select-none hover:border-gray-500 transition-colors shadow-sm"
                                    >
                                        {logoSrc && (
                                            <img
                                                src={logoSrc}
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                alt=""
                                                className="h-4 w-4 object-contain flex-shrink-0 opacity-90"
                                            />
                                        )}
                                        <span className="text-xs font-semibold truncate max-w-[120px] pl-0.5">{f.name}</span>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            className="cursor-pointer flex items-center justify-center hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded p-0.5 ml-0.5 transition-all flex-shrink-0"
                                            onClick={(e) => requestRemove(f.id, e)}
                                            onKeyDown={(e) => e.key === 'Enter' && requestRemove(f.id, e as unknown as React.MouseEvent)}
                                            title={`Remove ${f.name}`}
                                        >
                                            <X size={12} strokeWidth={2.5} />
                                        </span>
                                    </span>
                                )
                            })
                        ) : (
                            <span className="text-sm text-gray-500 block truncate">{placeholder}</span>
                        )}
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    </span>
                </ListboxButton>

                {/* ── Dropdown panel ── */}
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

                        // Quick select/deselect all for a super-faction
                        const groupIds = [vanilla?.id, ...sectorials.map(s => s.id)].filter((id): id is number => id !== undefined);
                        const groupSelectedCount = groupIds.filter(id => value.includes(id)).length;
                        const allGroupSelected = groupSelectedCount === groupIds.length && groupIds.length > 0;

                        const handleGroupToggle = (e: React.MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (allGroupSelected) {
                                // Deselect all in group
                                onChange(value.filter(v => !groupIds.includes(v)));
                            } else {
                                // Select all in group
                                const next = new Set([...value, ...groupIds]);
                                onChange(Array.from(next));
                            }
                        };

                        return (
                            <div key={group.id} className="border-b border-gray-700/50 last:border-b-0">
                                {/* ── Super-faction header ── */}
                                <button
                                    type="button"
                                    onClick={(e) => toggleGroup(group.id, e)}
                                    className="w-full sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 transition-colors border-b border-gray-700/40 text-left group"
                                >
                                    {headerLogo && (
                                        <img
                                            src={getSafeLogo(headerLogo)}
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            alt=""
                                            className="h-5 w-5 object-contain flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                                        />
                                    )}
                                    <span className="flex-1 text-xs font-bold text-gray-200 uppercase tracking-widest leading-none">
                                        {group.name}
                                    </span>
                                    <span className="text-[10px] text-gray-500 mr-1">{childCount}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleGroupToggle(e); }}
                                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors mr-1"
                                    >
                                        {allGroupSelected ? 'Deselect All' : 'Select All'}
                                    </button>
                                    {isCollapsed
                                        ? <ChevronRight className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                        : <ChevronDown className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                    }
                                </button>

                                {/* ── Options ── */}
                                {!isCollapsed && (
                                    <div>
                                        {vanilla && (
                                            <ListboxOption
                                                value={vanilla.id}
                                                className="group relative cursor-default select-none py-1.5 px-3 text-gray-100 data-[focus]:bg-gray-700 data-[focus]:text-white transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center justify-center w-4 h-4 border border-gray-500 rounded text-transparent group-data-[selected]:bg-accent-500 group-data-[selected]:border-accent-500 group-data-[selected]:text-white transition-colors flex-shrink-0">
                                                        <Check className="h-3 w-3" />
                                                    </div>
                                                    <img
                                                        src={getSafeLogo(vanilla.logo)}
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
                                            </ListboxOption>
                                        )}

                                        {sectorials.map(s => (
                                            <ListboxOption
                                                key={s.id}
                                                value={s.id}
                                                className="group relative cursor-default select-none py-1.5 px-3 text-gray-100 data-[focus]:bg-gray-700 data-[focus]:text-white transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center justify-center w-4 h-4 border border-gray-500 rounded text-transparent group-data-[selected]:bg-accent-500 group-data-[selected]:border-accent-500 group-data-[selected]:text-white transition-colors flex-shrink-0">
                                                        <Check className="h-3 w-3" />
                                                    </div>
                                                    <img
                                                        src={getSafeLogo(s.logo)}
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        alt=""
                                                        className="h-6 w-6 flex-shrink-0 object-contain"
                                                    />
                                                    <div>
                                                        <div className="font-semibold text-sm leading-tight group-data-[selected]:text-white">
                                                            {s.name}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">Sectorial</div>
                                                    </div>
                                                </div>
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
