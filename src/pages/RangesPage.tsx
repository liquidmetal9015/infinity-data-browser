// Ranges/Weapons Page - Main component with D3 visualization
import { useState, useMemo, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useModal } from '../context/ModalContext';
import { Info } from 'lucide-react';
import * as d3 from 'd3';
import {
    WeaponSidebar,
    WeaponTable,
    BestWeaponsBar,
    RANGE_BANDS,
    type BestWeaponInfo
} from '../components/RangesPage';
import { useRangesStore } from '../stores/useRangesStore';
import type { ParsedWeapon } from '../../shared/types';
import './RangesPage.css';

export function RangesPage() {
    const db = useDatabase();
    const { openUnitModal } = useModal();
    const { selectedWeaponIds, weaponSearch, toggleWeapon, setSelectedWeaponIds, setWeaponSearch } = useRangesStore();
    const [unitSearch, setUnitSearch] = useState('');
    // Derive Set from stored array for compatibility with downstream components
    const selectedIds = useMemo(() => new Set(selectedWeaponIds), [selectedWeaponIds]);
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<HTMLDivElement>(null);
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
        setTimeout(updateWidth, 100);

        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // Parse weapons data into usable range bands
    const allWeapons = useMemo(() => {
        if (!db.metadata) return [];

        const validWeapons: ParsedWeapon[] = [];
        const seenIds = new Set<number>();

        // Use the parsed details directly from BaseDatabase
        db.metadata.weapons.forEach(w => {
            if (seenIds.has(w.id)) return;
            seenIds.add(w.id);

            const details = db.getWeaponDetails(w.id);
            if (details) {
                validWeapons.push(details);
            }
        });

        return validWeapons.sort((a, b) => a.name.localeCompare(b.name));
    }, [db.metadata, db]);

    const filteredWeapons = useMemo(() => {
        return allWeapons.filter(w => w.name.toLowerCase().includes(weaponSearch.toLowerCase()));
    }, [allWeapons, weaponSearch]);

    const filteredUnits = useMemo(() => {
        if (!unitSearch.trim() || unitSearch.length < 2) return [];
        return db.units
            .filter(u => u.name.toLowerCase().includes(unitSearch.toLowerCase()))
            .slice(0, 5);
    }, [db.units, unitSearch]);

    const selectedWeapons = useMemo(() => {
        return allWeapons.filter(w => selectedIds.has(w.id));
    }, [allWeapons, selectedIds]);

    const selectUnitWeapons = (unitId: number) => {
        const unit = db.units.find(u => u.id === unitId);
        if (unit) {
            const relevantWeaponIds = Array.from(unit.allWeaponIds)
                .filter(id => allWeapons.some(w => w.id === id));
            setSelectedWeaponIds(relevantWeaponIds);
            setUnitSearch('');
        }
    };

    // Calculate Best Weapons per Band
    const bestWeapons = useMemo((): (BestWeaponInfo | null)[] => {
        if (selectedWeapons.length === 0) return [];

        return RANGE_BANDS.map(band => {
            let bestWeapon: ParsedWeapon | null = null;
            let bestMod = -Infinity;
            let secondBestMod = -Infinity;

            selectedWeapons.forEach(w => {
                const samplePoint = band.start + 1;
                const bandMod = w.bands.find(b => b.start < samplePoint && b.end >= samplePoint)?.mod ?? -Infinity;

                if (bandMod > bestMod) {
                    secondBestMod = bestMod;
                    bestMod = bandMod;
                    bestWeapon = w;
                } else if (bandMod > secondBestMod) {
                    secondBestMod = bandMod;
                }
            });

            if (bestMod <= -100) return null;

            return {
                band,
                weapon: bestWeapon,
                mod: bestMod,
                diff: secondBestMod > -Infinity ? bestMod - secondBestMod : 0
            };
        });
    }, [selectedWeapons]);

    // D3 Chart Drawing Effect
    useEffect(() => {
        if (!graphRef.current || containerWidth === 0) {
            return;
        }

        const container = graphRef.current;
        d3.select(container).selectAll("*").remove();

        if (selectedWeapons.length === 0) {
            return;
        }

        const width = containerWidth;
        const height = 300;
        const margin = { top: 20, right: 30, bottom: 40, left: 40 };

        const svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        const x = d3.scaleLinear().domain([0, 48]).range([margin.left, width - margin.right]);
        const y = d3.scaleLinear().domain([-6, 6]).range([height - margin.bottom, margin.top]);

        // Axes
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).tickValues([0, 8, 16, 24, 32, 40, 48]).tickFormat(d => d + '"'));

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).tickValues([-6, -3, 0, 3, 6]).tickFormat(d => d.valueOf() > 0 ? `+${d}` : `${d}`));

        // Grid lines
        svg.append("g").attr("class", "grid")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).tickValues([0, 8, 16, 24, 32, 40, 48]).tickSize(-height + margin.top + margin.bottom).tickFormat(() => ""))
            .attr("stroke-opacity", 0.1);

        svg.append("g").attr("class", "grid")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).tickValues([-6, -3, 0, 3, 6]).tickSize(-width + margin.left + margin.right).tickFormat(() => ""))
            .attr("stroke-opacity", 0.1);

        // Zero line
        svg.append("line")
            .attr("x1", margin.left).attr("x2", width - margin.right)
            .attr("y1", y(0)).attr("y2", y(0))
            .attr("stroke", "var(--text-secondary)").attr("stroke-width", 1).attr("stroke-dasharray", "4");

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // Draw weapon lines
        selectedWeapons.forEach((weapon, i) => {
            const points: [number, number][] = [];
            weapon.bands.forEach(band => {
                if (band.start > 56) return;
                const endX = Math.min(band.end, 56);
                points.push([band.start, band.mod]);
                points.push([endX, band.mod]);
            });

            svg.append("path")
                .datum(points)
                .attr("fill", "none")
                .attr("stroke", color(i.toString()))
                .attr("stroke-width", 3)
                .attr("d", d3.line().x(d => x(d[0])).y(d => y(d[1])))
                .attr("stroke-opacity", 0.8);
        });

        // Template bars
        selectedWeapons.forEach((weapon, i) => {
            if (weapon.templateType && weapon.templateType !== 'none') {
                const templateLength = weapon.templateType === 'small' ? 8.4 : 10.2;
                const barHeight = 40;
                const yPos = y(0) - (barHeight / 2);

                svg.append("rect")
                    .attr("x", x(0)).attr("y", yPos)
                    .attr("width", x(templateLength) - x(0)).attr("height", barHeight)
                    .attr("fill", color(i.toString())).attr("fill-opacity", 0.3)
                    .attr("stroke", color(i.toString())).attr("stroke-width", 2);

                svg.append("text")
                    .attr("x", x(templateLength / 2)).attr("y", yPos - 5)
                    .attr("fill", color(i.toString())).attr("text-anchor", "middle")
                    .attr("font-size", "10px").attr("font-weight", "bold")
                    .text("DIRECT TEMPLATE");
            }
        });
    }, [selectedWeapons, containerWidth]);

    // toggleWeapon is now provided by the store

    return (
        <div className="page-container ranges-page">
            <div className="ranges-layout">
                <WeaponSidebar
                    weaponSearch={weaponSearch}
                    setWeaponSearch={setWeaponSearch}
                    unitSearch={unitSearch}
                    setUnitSearch={setUnitSearch}
                    filteredWeapons={filteredWeapons}
                    filteredUnits={filteredUnits}
                    selectedIds={selectedIds}
                    onToggleWeapon={toggleWeapon}
                    onSelectUnitWeapons={selectUnitWeapons}
                    onViewUnit={openUnitModal}
                />

                <div className="chart-area" ref={containerRef}>
                    {selectedWeapons.length === 0 ? (
                        <div key="empty-chart" className="empty-chart">
                            <Info size={48} />
                            <p>Select a unit or weapons to visualize ranges.</p>
                        </div>
                    ) : (
                        <>
                            <div key="d3-container" className="d3-container" ref={graphRef}></div>
                            <BestWeaponsBar bestWeapons={bestWeapons} selectedWeapons={selectedWeapons} />
                            <WeaponTable weapons={selectedWeapons} onRemoveWeapon={toggleWeapon} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
