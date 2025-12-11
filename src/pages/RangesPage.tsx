import { useState, useMemo, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Search, Info } from 'lucide-react';
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

export function RangesPage() {
    const db = useDatabase();
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse weapons data into usable range bands
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
                        .map(([key, val]) => ({ key, max: val!.max, mod: parseInt(val!.mod) }))
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
        return allWeapons.filter(w => w.name.toLowerCase().includes(search.toLowerCase()));
    }, [allWeapons, search]);

    const selectedWeapons = useMemo(() => {
        return allWeapons.filter(w => selectedIds.has(w.id));
    }, [allWeapons, selectedIds]);

    // D3 Chart Drawing Effect
    useEffect(() => {
        if (!containerRef.current || selectedWeapons.length === 0) {
            d3.select(containerRef.current).selectAll("*").remove();
            return;
        }

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = 400;
        const margin = { top: 20, right: 30, bottom: 40, left: 40 };

        // Clear previous
        d3.select(container).selectAll("*").remove();

        const svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        // Scales
        const x = d3.scaleLinear()
            .domain([0, 96]) // Max standard range usually 96"
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([-6, 6]) // Mods usually -6 to +3 (extending to +6 for safety)
            .range([height - margin.bottom, margin.top]);

        // Draw Axes
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(10))
            .append("text")
            .attr("x", width - margin.right)
            .attr("y", -6)
            .attr("fill", "currentColor")
            .text("Range (inches)");

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y))
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
            .call(d3.axisBottom(x).ticks(10).tickSize(-height + margin.top + margin.bottom).tickFormat(() => ""))
            .attr("stroke-opacity", 0.1);

        svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(5).tickSize(-width + margin.left + margin.right).tickFormat(() => ""))
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
            const linePath = d3.path();

            // Start
            linePath.moveTo(x(0), y(weapon.bands[0]?.mod || 0));

            weapon.bands.forEach(band => {
                // Horizontal line for the band
                linePath.lineTo(x(band.end), y(band.mod));
                // If there is a next band, vertical line to it? No, step chart
                // For step chart, we draw H then V.
            });

            // To make it a proper step function, we need point-to-point
            // (start, mod) -> (end, mod) -> (end, nextMod) ...

            const points: [number, number][] = [];
            weapon.bands.forEach(band => {
                points.push([band.start, band.mod]);
                points.push([band.end, band.mod]); // End of band step
            });

            // Line generator
            const line = d3.line()
                .x(d => x(d[0]))
                .y(d => y(d[1]));

            svg.append("path")
                .datum(points)
                .attr("fill", "none")
                .attr("stroke", color(i.toString()))
                .attr("stroke-width", 2.5)
                .attr("d", line);

            // Add Label at the end or start?
            // Legend is better handled in React UI
        });

    }, [selectedWeapons]);


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
                        <div className="search-wrapper">
                            <Search className="search-icon" size={16} />
                            <input
                                type="text"
                                placeholder="Filter weapons..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
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
                <div className="chart-area">
                    {selectedWeapons.length === 0 ? (
                        <div className="empty-chart">
                            <Info size={48} />
                            <p>Select weapons from the list to compare their range bands.</p>
                        </div>
                    ) : (
                        <>
                            <div ref={containerRef} className="d3-container"></div>
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
                    height: calc(100vh - 80px); /* Adjust for header */
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 1rem 2rem;
                }
                .ranges-layout {
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    gap: 2rem;
                    height: 100%;
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
                }
                .sidebar-header h2 {
                    font-size: 1.2rem;
                    margin: 0 0 1rem 0;
                }
                .weapon-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0.5rem;
                }
                .weapon-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .weapon-item:hover {
                    background: var(--bg-hover);
                }
                .weapon-item.selected {
                    background: rgba(var(--color-primary-rgb), 0.1);
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
                    padding: 2rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    position: relative;
                }
                .d3-container {
                    width: 100%;
                    flex: 1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
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
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--text-secondary);
                    text-align: center;
                }
                .empty-chart p {
                    margin-top: 1rem;
                    font-size: 1.1rem;
                }

                .chart-legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border-color);
                    width: 100%;
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.25rem 0.75rem;
                    background: var(--bg-primary);
                    border-radius: 100px;
                    font-size: 0.9rem;
                    border: 1px solid var(--border-color);
                }
                .legend-color {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                }
                .remove-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-size: 1.2rem;
                    line-height: 1;
                    padding: 0 0.25rem;
                }
                .remove-btn:hover {
                    color: var(--color-danger, #ef4444);
                }
            `}</style>
        </div>
    );
}
