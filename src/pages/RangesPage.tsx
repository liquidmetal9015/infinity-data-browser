import { useState, useMemo, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useModal } from '../context/ModalContext';
import { Search, Info, Trophy } from 'lucide-react';
import * as d3 from 'd3';
import './RangesPage.css';

interface RangeBand {
    start: number;
    end: number;
    mod: number;
}

interface ParsedWeapon {
    id: number;
    name: string;
    bands: RangeBand[];
    burst: string;
    damage: string;
    saving: string;
    savingNum: string;
    ammunition: string; // Name of ammo
    properties: string[];
    templateType?: 'small' | 'large' | 'none';
}

// Standard range bands in inches
const RANGE_BANDS = [
    { start: 0, end: 8, label: '0-8"' },
    { start: 8, end: 16, label: '8-16"' },
    { start: 16, end: 24, label: '16-24"' },
    { start: 24, end: 32, label: '24-32"' },
    { start: 32, end: 40, label: '32-40"' },
    { start: 40, end: 48, label: '40-48"' },
    { start: 48, end: 96, label: '48-96"' },
];

export function RangesPage() {
    const db = useDatabase();
    const { openUnitModal } = useModal();
    const [weaponSearch, setWeaponSearch] = useState('');
    const [unitSearch, setUnitSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    // Handle Resize
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.clientWidth);
            }
        };

        window.addEventListener('resize', updateWidth);
        updateWidth();

        // Small delay to ensure layout is settled
        setTimeout(updateWidth, 100);

        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // Parse weapons data into usable range bands (Converted to Inches)
    const allWeapons = useMemo(() => {
        if (!db.metadata) return [];

        const weaponsMap = new Map<number, ParsedWeapon>();

        db.metadata.weapons
            // .filter(w => w.distance) // REMOVE THIS FILTER so we can catch template weapons with null distance
            .forEach(w => {
                if (weaponsMap.has(w.id)) return; // Skip duplicates

                const bands: RangeBand[] = [];
                let templateType: 'small' | 'large' | 'none' = 'none';

                // Check for Direct Template first
                if (w.properties && w.properties.some(p => p.includes('Direct Template'))) {
                    // It's a template weapon
                    if (w.properties.some(p => p.includes('Small Teardrop'))) {
                        templateType = 'small';
                    } else if (w.properties.some(p => p.includes('Large Teardrop'))) {
                        templateType = 'large';
                    }
                }

                if (w.distance) {
                    // Convert distance object to array and sort by max range
                    const parts = Object.entries(w.distance)
                        .filter(([, val]) => val !== null) // Filter out null bands
                        .map(([, val]) => ({
                            // Convert CM to Inches (approx 0.4 factor, 10cm = 4in)
                            max: Math.round(val!.max * 0.4),
                            mod: parseInt(val!.mod)
                        }))
                        .sort((a, b) => a.max - b.max);

                    let currentStart = 0;
                    for (const part of parts) {
                        if (part.max > currentStart) {
                            bands.push({
                                start: currentStart,
                                end: part.max,
                                mod: part.mod
                            });
                            currentStart = part.max;
                        }
                    }
                }
                // Resolve Ammo Name
                let ammoName = '-';
                if (w.ammunition) {
                    const ammo = db.metadata!.ammunitions.find(a => a.id === w.ammunition);
                    ammoName = ammo ? ammo.name : w.ammunition.toString();
                }

                // If it has NO distance bands but IS a template weapon, add it
                if (bands.length === 0 && templateType !== 'none') {
                    // We don't synthesize bands here for the graph anymore, we handle it via templateType
                } else if (bands.length === 0) {
                    return; // Skip if no distance and no template
                }

                weaponsMap.set(w.id, {
                    id: w.id,
                    name: w.name,
                    bands,
                    burst: w.burst || '-',
                    damage: w.damage || '-',
                    saving: w.saving || '-',
                    savingNum: w.savingNum || '-',
                    ammunition: ammoName,
                    properties: w.properties || [],
                    templateType
                });
            });

        return Array.from(weaponsMap.values())
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db.metadata]);

    const filteredWeapons = useMemo(() => {
        return allWeapons.filter(w => w.name.toLowerCase().includes(weaponSearch.toLowerCase()));
    }, [allWeapons, weaponSearch]);

    // Unit Search Results
    const filteredUnits = useMemo(() => {
        if (!unitSearch.trim() || unitSearch.length < 2) return [];
        return db.units
            .filter(u => u.name.toLowerCase().includes(unitSearch.toLowerCase()))
            .slice(0, 5); // Limit to top 5 matches
    }, [db.units, unitSearch]);

    const selectedWeapons = useMemo(() => {
        return allWeapons.filter(w => selectedIds.has(w.id));
    }, [allWeapons, selectedIds]);

    const selectUnitWeapons = (unitId: number) => {
        const unit = db.units.find(u => u.id === unitId);
        if (unit) {
            // Find all weapons this unit has that exist in our parsed weapon list
            const relevantWeaponIds = Array.from(unit.allWeaponIds)
                .filter(id => allWeapons.some(w => w.id === id));

            setSelectedIds(new Set(relevantWeaponIds));
            setUnitSearch(''); // Clear search
        }
    };

    // Calculate Best Weapons per Band
    const bestWeapons = useMemo(() => {
        if (selectedWeapons.length === 0) return [];

        return RANGE_BANDS.map(band => {
            let bestWeapon: ParsedWeapon | null = null;
            let bestMod = -Infinity;
            let secondBestMod = -Infinity;

            selectedWeapons.forEach(w => {
                // Find the modifier for this band (using middle of band to sample)
                const samplePoint = band.start + 1;
                const bandMod = w.bands.find(b => b.start < samplePoint && b.end >= samplePoint)?.mod ?? -Infinity;

                if (bandMod > bestMod) {
                    secondBestMod = bestMod;
                    bestMod = bandMod;
                    bestWeapon = w;
                } else if (bandMod === bestMod) {
                    // Tie logic (could be range, damage, etc. For now keep existing)
                } else if (bandMod > secondBestMod) {
                    secondBestMod = bandMod;
                }
            });

            // If effective mod is too low (e.g. out of range), don't show
            if (bestMod <= -100) return null;

            return {
                band,
                weapon: bestWeapon,
                mod: bestMod,
                diff: secondBestMod > -Infinity ? bestMod - secondBestMod : 0
            };
        });

    }, [selectedWeapons]);


    const graphRef = useRef<HTMLDivElement>(null);

    // D3 Chart Drawing Effect
    useEffect(() => {
        if (!graphRef.current || selectedWeapons.length === 0 || containerWidth === 0) {
            // Safety cleanup: Ensure no stray SVGs if we have no weapons
            return;
        }

        const container = graphRef.current;
        const width = containerWidth;
        const height = 300; // Reduced height
        const margin = { top: 20, right: 30, bottom: 40, left: 40 };

        // Clear previous D3 content ONLY
        d3.select(container).selectAll("*").remove();

        const svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        // Scales
        const x = d3.scaleLinear()
            .domain([0, 48]) // Focus on 0-48", allow extending if needed
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([-6, 6]) // Mods usually -6 to +3 
            .range([height - margin.bottom, margin.top]);

        // Draw Axes with Inch ticks
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x)
                .tickValues([0, 8, 16, 24, 32, 40, 48])
                .tickFormat(d => d + '"')
            )
            .append("text")
            .attr("x", width - margin.right)
            .attr("y", 35) // Increased padding to avoid cut-off
            .attr("fill", "currentColor")
            .style("text-anchor", "end")
            .text("Range (inches)");

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y)
                .tickValues([-6, -3, 0, 3, 6]) // Exact Infinity Modifiers
                .tickFormat((d) => {
                    const val = d.valueOf();
                    return val > 0 ? `+${val}` : `${val}`;
                })
            )
            .append("text")
            .attr("x", 5)
            .attr("y", margin.top - 10)
            .attr("fill", "currentColor")
            .style("text-anchor", "start")
            .text("Mod");

        // Grid lines
        svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x)
                .tickValues([0, 8, 16, 24, 32, 40, 48])
                .tickSize(-height + margin.top + margin.bottom)
                .tickFormat(() => "")
            )
            .attr("stroke-opacity", 0.1);

        svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y)
                .tickValues([-6, -3, 0, 3, 6])
                .tickSize(-width + margin.left + margin.right)
                .tickFormat(() => "")
            )
            .attr("stroke-opacity", 0.1);

        // Zero line
        svg.append("line")
            .attr("x1", margin.left)
            .attr("x2", width - margin.right)
            .attr("y1", y(0))
            .attr("y2", y(0))
            .attr("stroke", "var(--text-secondary)")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4");


        // Color scale
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // Draw Lines
        selectedWeapons.forEach((weapon, i) => {
            const points: [number, number][] = [];

            // Generate step points: start->end for each band
            weapon.bands.forEach(band => {
                // If band starts beyond our view (e.g. 96"), clip it or skip?
                // For now, let's clamp max view at 52" so graph looks clean, but actual data goes further
                if (band.start > 56) return;

                const endX = Math.min(band.end, 56);

                points.push([band.start, band.mod]);
                points.push([endX, band.mod]);
            });

            const line = d3.line()
                .x(d => x(d[0]))
                .y(d => y(d[1]));

            svg.append("path")
                .datum(points)
                .attr("fill", "none")
                .attr("stroke", color(i.toString()))
                .attr("stroke-width", 3)
                .attr("d", line)
                .attr("stroke-opacity", 0.8);
        });

        // Draw Template Bars (Overlay)
        selectedWeapons.forEach((weapon, i) => {
            if (weapon.templateType && weapon.templateType !== 'none') {
                const templateLength = weapon.templateType === 'small' ? 8.4 : 10.2;
                const barHeight = 40; // Height of the bar
                const yPos = y(0) - (barHeight / 2); // Center on 0 line

                // Draw rectangle
                svg.append("rect")
                    .attr("x", x(0))
                    .attr("y", yPos)
                    .attr("width", x(templateLength) - x(0))
                    .attr("height", barHeight)
                    .attr("fill", color(i.toString()))
                    .attr("fill-opacity", 0.3)
                    .attr("stroke", color(i.toString()))
                    .attr("stroke-width", 2);

                // Label
                svg.append("text")
                    .attr("x", x(templateLength / 2))
                    .attr("y", yPos - 5)
                    .attr("fill", color(i.toString()))
                    .attr("text-anchor", "middle")
                    .attr("font-size", "10px")
                    .attr("font-weight", "bold")
                    .text("DIRECT TEMPLATE");
            }
        });

    }, [selectedWeapons, containerWidth]);


    const toggleWeapon = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    return (
        <div className="page-container ranges-page">
            <div className="ranges-layout">
                {/* Left: Sidebar Selector */}
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
                                            onClick={() => selectUnitWeapons(u.id)}
                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        >
                                            <span style={{ flex: 1 }}>{u.name}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openUnitModal(u);
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
                                onClick={() => toggleWeapon(w.id)}
                            >
                                <span className="weapon-name">{w.name}</span>
                            </div>
                        ))}
                        {filteredWeapons.length === 0 && (
                            <div className="empty-msg">No weapons found</div>
                        )}
                    </div>
                </div>

                {/* Right: Chart Area */}
                <div className="chart-area" ref={containerRef}>
                    {selectedWeapons.length === 0 ? (
                        <div className="empty-chart">
                            <Info size={48} />
                            <p>Select a unit or weapons to visualize ranges.</p>
                        </div>
                    ) : (
                        <>
                            <div className="d3-container" ref={graphRef}></div>

                            {/* Best Weapons Analysis - Compacted */}
                            <div className="analysis-bar">
                                <h3><Trophy size={14} /> Best Options</h3>
                                <div className="range-strip">
                                    {bestWeapons.map((item, i) => {
                                        if (!item || !item.weapon || item.band.start >= 48) return null;
                                        const weapon = item.weapon as ParsedWeapon;
                                        const weaponIndex = selectedWeapons.findIndex(w => w.id === weapon.id);
                                        const color = d3.schemeCategory10[weaponIndex % 10];
                                        return (
                                            <div key={i} className="range-block" style={{ flex: 1, borderTop: `3px solid ${color}` }}>
                                                <div className="range-label">{item.band.label}</div>
                                                <div className="winner-name" style={{ color }}>{weapon.name}</div>
                                                <div className="winner-mod">
                                                    {item.mod > 0 ? '+' : ''}{item.mod}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedWeapons.length > 0 && (
                                <div className="stats-section">
                                    <table className="weapon-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '20%' }}>Name</th>
                                                <th style={{ width: '25%' }}>Range</th>
                                                <th className="text-center" title="Power / Damage">PS</th>
                                                <th className="text-center" title="Burst">B</th>
                                                <th className="text-center">AMMO</th>
                                                <th className="text-center">SR: ATTRIB</th>
                                                <th className="text-center" title="Saving Roll Number">SR: No</th>
                                                <th style={{ width: '20%' }}>Traits</th>
                                                <th style={{ width: '30px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedWeapons.map((w, i) => {
                                                const color = d3.schemeCategory10[i % 10];
                                                return (
                                                    <tr key={w.id}>
                                                        <td className="weapon-cell-name">
                                                            <div className="color-indicator" style={{ background: color }}></div>
                                                            <span style={{ fontWeight: 600 }}>{w.name}</span>
                                                        </td>
                                                        <td className="weapon-cell-ranges">
                                                            <div className="range-strip-row">
                                                                {RANGE_BANDS.slice(0, 7).map((band, idx) => {
                                                                    const samplePoint = band.start + 1;
                                                                    const bandMod = w.bands.find(b => b.start < samplePoint && b.end >= samplePoint)?.mod ?? null;

                                                                    let modClass = 'mod-0';
                                                                    let content: string | number = '-';

                                                                    // Template Handling
                                                                    if (w.templateType && w.templateType !== 'none') {
                                                                        const tLen = w.templateType === 'small' ? 8.4 : 10.2;
                                                                        if (band.start < tLen) {
                                                                            modClass = 'mod-template';
                                                                            content = 'DT'; // Direct Template
                                                                        } else {
                                                                            modClass = 'mod-none';
                                                                            content = '-';
                                                                        }
                                                                    } else {
                                                                        // Standard Bands
                                                                        if (bandMod === null) {
                                                                            modClass = 'mod-none';
                                                                            content = '-';
                                                                        }
                                                                        else if (bandMod > 0) {
                                                                            modClass = 'mod-pos';
                                                                            content = `+${bandMod}`;
                                                                        }
                                                                        else if (bandMod < 0) {
                                                                            modClass = 'mod-neg';
                                                                            content = bandMod;
                                                                        } else {
                                                                            content = '0';
                                                                        }
                                                                    }

                                                                    return (
                                                                        <div key={idx} className={`range-cell ${modClass}`} title={band.label}>
                                                                            {content}
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </td>
                                                        <td className="text-center font-medium">{w.damage}</td>
                                                        <td className="text-center font-medium">{w.burst}</td>
                                                        <td className="text-center text-sm">{w.ammunition}</td>
                                                        <td className="text-center text-sm">{w.saving}</td>
                                                        <td className="text-center text-sm">{w.savingNum || '-'}</td>
                                                        <td className="weapon-cell-traits">
                                                            <div className="traits-list">
                                                                {w.properties.map(p => <span key={p} className="trait-text">{p}</span>)}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="remove-row-btn"
                                                                onClick={() => toggleWeapon(w.id)}
                                                            >×</button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
