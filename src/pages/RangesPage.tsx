import { useState, useMemo, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Search, Info, Trophy } from 'lucide-react';
import * as d3 from 'd3';

interface RangeBand {
    start: number;
    end: number;
    mod: number;
}

interface ParsedWeapon {
    id: number;
    name: string;
    bands: RangeBand[];
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
            .filter(w => w.distance) // Only weapons with range data
            .forEach(w => {
                if (weaponsMap.has(w.id)) return; // Skip duplicates

                const bands: RangeBand[] = [];
                if (w.distance) {
                    // Convert distance object to array and sort by max range
                    const parts = Object.entries(w.distance)
                        .filter(([_, val]) => val !== null) // Filter out null bands
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
                weaponsMap.set(w.id, { id: w.id, name: w.name, bands });
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
            return;
        }

        const container = graphRef.current;
        const width = containerWidth;
        const height = 400;
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
            .attr("y", -6)
            .attr("fill", "currentColor")
            .text("Range (inches)");

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(6))
            .append("text")
            .attr("x", 6)
            .attr("y", margin.top)
            .attr("dy", "0.71em")
            .attr("fill", "currentColor")
            .text("Modifier");

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
            .call(d3.axisLeft(y).ticks(6).tickSize(-width + margin.left + margin.right).tickFormat(() => ""))
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
                                        >
                                            {u.name}
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
                            <label key={w.id} className={`weapon-item ${selectedIds.has(w.id) ? 'selected' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(w.id)}
                                    onChange={() => toggleWeapon(w.id)}
                                />
                                <span className="weapon-name">{w.name}</span>
                            </label>
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
                            <p>Select a unit or weapons to visualize ranges (Inches).</p>
                        </div>
                    ) : (
                        <>
                            <div className="d3-container" ref={graphRef}></div>

                            {/* Best Weapons Analysis */}
                            <div className="analysis-bar">
                                <h3><Trophy size={16} /> Best Options per Range</h3>
                                <div className="range-strip">
                                    {bestWeapons.map((item, i) => {
                                        if (!item || !item.weapon || item.band.start >= 48) return null;
                                        const weapon = item.weapon as ParsedWeapon;
                                        const weaponIndex = selectedWeapons.findIndex(w => w.id === weapon.id);
                                        const color = d3.schemeCategory10[weaponIndex % 10];
                                        return (
                                            <div key={i} className="range-block" style={{ flex: 1, borderTop: `4px solid ${color}` }}>
                                                <div className="range-label">{item.band.label}</div>
                                                <div className="winner-name" style={{ color }}>{weapon.name}</div>
                                                <div className="winner-mod">
                                                    {item.mod > 0 ? '+' : ''}{item.mod}
                                                    {item.diff > 0 && <span className="diff-badge" title="Better than next best">+{item.diff}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="chart-legend">
                                {selectedWeapons.map((w, i) => (
                                    <div key={w.id} className="legend-item">
                                        <div
                                            className="legend-color"
                                            style={{ background: d3.schemeCategory10[i % 10] }}
                                        ></div>
                                        <span>{w.name}</span>
                                        <button
                                            onClick={() => toggleWeapon(w.id)}
                                            className="remove-btn"
                                            title="Remove"
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <style>{`
                .ranges-page {
                    height: calc(100vh - 80px);
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 1rem 2rem;
                }
                .ranges-layout {
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    gap: 1.5rem;
                    height: 100%;
                    overflow: hidden;
                }
                
                /* Sidebar */
                .sidebar {
                    display: flex;
                    flex-direction: column;
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    overflow: hidden;
                }
                .sidebar-header {
                    padding: 1rem;
                    border-bottom: 1px solid var(--border-color);
                    background: var(--bg-secondary);
                    z-index: 10;
                }
                .sidebar-header h2 {
                    font-size: 1.1rem;
                    margin: 0 0 1rem 0;
                }
                .unit-search-section {
                    position: relative;
                    margin-bottom: 1rem;
                }
                .autocomplete-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    z-index: 100;
                    max-height: 200px;
                    overflow-y: auto;
                }
                .autocomplete-item {
                    padding: 0.5rem 1rem;
                    cursor: pointer;
                    font-size: 0.9rem;
                }
                .autocomplete-item:hover {
                    background: var(--bg-hover);
                    color: var(--color-primary);
                }
                .divider {
                    text-align: center;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin: 0.5rem 0;
                    position: relative;
                }
                
                .weapon-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0.5rem;
                }
                .weapon-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.4rem 0.75rem; /* More compact */
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: background 0.2s;
                }
                .weapon-item:hover {
                    background: var(--bg-hover);
                }
                .weapon-item.selected {
                    background: rgba(var(--color-primary-rgb), 0.1);
                    color: var(--color-primary);
                }
                .search-input {
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                }

                /* Chart Area */
                .chart-area {
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto; /* Allow scrolling if content is tall */
                }
                .d3-container {
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 400px;
                }
                .d3-container svg {
                    overflow: visible;
                }
                .d3-container text {
                    fill: var(--text-secondary);
                    font-size: 12px;
                }
                .d3-container .grid line {
                    stroke: var(--border-color);
                }
                
                .empty-chart {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                    text-align: center;
                }

                /* Analysis Bar */
                .analysis-bar {
                    margin-top: 2rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border-color);
                }
                .analysis-bar h3 {
                    font-size: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                    color: var(--text-primary);
                }
                .range-strip {
                    display: flex;
                    gap: 0.5rem;
                    overflow-x: auto;
                    padding-bottom: 0.5rem;
                }
                .range-block {
                    background: var(--bg-primary);
                    padding: 0.75rem;
                    border-radius: 6px;
                    min-width: 100px;
                    border: 1px solid var(--border-color);
                    text-align: center;
                }
                .range-label {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.25rem;
                }
                .winner-name {
                    font-weight: 600;
                    font-size: 0.9rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .winner-mod {
                    font-size: 1.1rem;
                    font-weight: 700;
                    margin-top: 0.2rem;
                }
                .diff-badge {
                    font-size: 0.7rem;
                    background: var(--color-success, #22c55e);
                    color: white;
                    padding: 0.1rem 0.3rem;
                    border-radius: 4px;
                    margin-left: 0.4rem;
                    vertical-align: top;
                }

                .chart-legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    margin-top: 1.5rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border-color);
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.2rem 0.6rem;
                    background: var(--bg-primary);
                    border-radius: 100px;
                    font-size: 0.85rem;
                    border: 1px solid var(--border-color);
                }
                .legend-color {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }
                .remove-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-size: 1.1rem;
                    margin-left: 0.2rem;
                    display: flex;
                    align-items: center;
                }
                .remove-btn:hover {
                    color: var(--color-danger, #ef4444);
                }
            `}</style>
        </div>
    );
}
