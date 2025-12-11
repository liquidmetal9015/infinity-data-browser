import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Users, Grid3X3 } from 'lucide-react';
import { Database } from '../services/Database';
import type { Unit } from '../types';

interface BubbleChartProps {
    units: Unit[];
}

interface BubbleData {
    id: number;
    name: string;
    shortName: string;
    value: number;
    hasAccess: boolean;
}

type ViewMode = 'sectorials' | 'super-factions';

export const BubbleChart: React.FC<BubbleChartProps> = ({ units }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('sectorials');
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [tooltip, setTooltip] = useState<{ x: number; y: number; data: BubbleData | null }>({ x: 0, y: 0, data: null });

    const db = Database.getInstance();

    // Build faction -> units mapping
    const factionMap = useMemo(() => {
        const map: Record<number, Unit[]> = {};
        units.forEach(u => {
            u.factions.forEach(fid => {
                if (!map[fid]) map[fid] = [];
                map[fid].push(u);
            });
        });
        return map;
    }, [units]);

    // Build bubble data based on view mode
    const bubbleData = useMemo((): BubbleData[] => {
        const data: BubbleData[] = [];

        if (viewMode === 'sectorials') {
            // Each faction/sectorial is its own bubble
            const allFactionIds = Array.from(db.factionMap.keys());
            for (const fid of allFactionIds) {
                const unitCount = factionMap[fid]
                    ? new Set(factionMap[fid].map(u => u.name)).size
                    : 0;
                data.push({
                    id: fid,
                    name: db.getFactionName(fid),
                    shortName: db.getFactionShortName(fid),
                    value: unitCount,
                    hasAccess: unitCount > 0
                });
            }
        } else {
            // Super-faction view: deduplicate units across sectorials
            const superFactions = db.getGroupedFactions();
            for (const sf of superFactions) {
                const allFidsInGroup: number[] = [];
                if (sf.vanilla) allFidsInGroup.push(sf.vanilla.id);
                sf.sectorials.forEach(s => allFidsInGroup.push(s.id));

                // Collect unique unit names across all sectorials in this super-faction
                const unitNames = new Set<string>();
                for (const fid of allFidsInGroup) {
                    if (factionMap[fid]) {
                        factionMap[fid].forEach(u => unitNames.add(u.name));
                    }
                }

                data.push({
                    id: sf.id,
                    name: sf.name,
                    shortName: sf.shortName,
                    value: unitNames.size,
                    hasAccess: unitNames.size > 0
                });
            }
        }

        return data.sort((a, b) => b.value - a.value);
    }, [viewMode, factionMap, db]);

    // Update dimensions on resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const { width } = containerRef.current.getBoundingClientRect();
                setDimensions({ width: Math.max(400, width), height: Math.max(400, Math.min(600, width * 0.75)) });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Render bubbles with d3
    useEffect(() => {
        if (!svgRef.current || bubbleData.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const { width, height } = dimensions;
        const margin = 20;

        // Create hierarchy data with proper typing
        interface HierarchyNode { children?: BubbleData[]; }
        const hierarchyData: HierarchyNode & { children: BubbleData[] } = { children: bubbleData };
        const root = d3.hierarchy(hierarchyData)
            .sum(d => {
                const bubbleItem = d as unknown as BubbleData;
                return Math.max(bubbleItem.value || 0, 1);
            });

        // Create pack layout
        const pack = d3.pack<HierarchyNode>()
            .size([width - margin * 2, height - margin * 2])
            .padding(3);

        const nodes = pack(root as d3.HierarchyNode<HierarchyNode>).leaves();

        // Color scale based on value
        const maxValue = d3.max(bubbleData, d => d.value) || 1;
        const colorScale = d3.scaleSequential(d3.interpolateBlues)
            .domain([0, maxValue]);

        // Create group for bubbles
        const g = svg.append('g')
            .attr('transform', `translate(${margin}, ${margin})`);

        // Add bubbles
        const bubbles = g.selectAll('.bubble')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'bubble')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);

        // Bubble circles
        bubbles.append('circle')
            .attr('r', d => d.r)
            .attr('fill', d => {
                const data = d.data as BubbleData;
                if (!data.hasAccess) return 'rgba(239, 68, 68, 0.15)';
                return colorScale(data.value);
            })
            .attr('stroke', d => {
                const data = d.data as BubbleData;
                if (!data.hasAccess) return 'rgba(239, 68, 68, 0.4)';
                return 'rgba(96, 165, 250, 0.5)';
            })
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseenter', function (_, d) {
                const data = d.data as BubbleData;
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('stroke-width', 3)
                    .attr('stroke', data.hasAccess ? 'rgba(96, 165, 250, 1)' : 'rgba(239, 68, 68, 0.8)');

                const rect = svgRef.current?.getBoundingClientRect();
                if (rect) {
                    setTooltip({
                        x: d.x + margin,
                        y: d.y + margin - d.r - 10,
                        data
                    });
                }
            })
            .on('mouseleave', function (_, d) {
                const data = d.data as BubbleData;
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('stroke-width', 2)
                    .attr('stroke', data.hasAccess ? 'rgba(96, 165, 250, 0.5)' : 'rgba(239, 68, 68, 0.4)');
                setTooltip({ x: 0, y: 0, data: null });
            });

        // Bubble labels (only for larger bubbles)
        bubbles.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.3em')
            .attr('fill', d => {
                const data = d.data as BubbleData;
                if (!data.hasAccess) return 'rgba(239, 68, 68, 0.6)';
                return data.value > maxValue * 0.4 ? 'white' : 'rgba(255, 255, 255, 0.9)';
            })
            .attr('font-size', d => Math.min(d.r / 3, 14))
            .attr('font-weight', 500)
            .style('pointer-events', 'none')
            .text(d => {
                const data = d.data as BubbleData;
                // Only show text if bubble is big enough
                if (d.r < 25) return '';
                // Truncate long names
                const name = data.shortName;
                const maxLen = Math.floor(d.r / 4);
                return name.length > maxLen ? name.slice(0, maxLen) + '…' : name;
            });

        // Value labels for larger bubbles
        bubbles.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.r > 35 ? '1.5em' : '0.3em')
            .attr('fill', 'rgba(255, 255, 255, 0.7)')
            .attr('font-size', d => Math.min(d.r / 4, 11))
            .attr('font-family', 'monospace')
            .style('pointer-events', 'none')
            .text(d => {
                const data = d.data as BubbleData;
                if (d.r < 20) return '';
                if (d.r < 35) return data.value.toString();
                return '';
            });

        // Separate value label for big bubbles
        bubbles.filter(d => d.r >= 35)
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '1.8em')
            .attr('fill', 'rgba(255, 255, 255, 0.6)')
            .attr('font-size', 10)
            .attr('font-family', 'monospace')
            .style('pointer-events', 'none')
            .text(d => {
                const data = d.data as BubbleData;
                return data.value + ' units';
            });

    }, [bubbleData, dimensions]);

    return (
        <div className="bubble-chart-container">
            {/* View Mode Toggle */}
            <div className="bubble-chart-controls">
                <div className="view-toggle-group">
                    <button
                        className={`view-toggle-btn ${viewMode === 'sectorials' ? 'active' : ''}`}
                        onClick={() => setViewMode('sectorials')}
                        title="Show each sectorial separately"
                    >
                        <Grid3X3 size={14} />
                        <span>Sectorials</span>
                    </button>
                    <button
                        className={`view-toggle-btn ${viewMode === 'super-factions' ? 'active' : ''}`}
                        onClick={() => setViewMode('super-factions')}
                        title="Group by parent faction (deduplicated)"
                    >
                        <Users size={14} />
                        <span>Super-Factions</span>
                    </button>
                </div>
                <div className="bubble-legend">
                    <span className="legend-item access">Has Access</span>
                    <span className="legend-item denied">No Access</span>
                </div>
            </div>

            {/* Chart Container */}
            <div className="bubble-chart-wrapper" ref={containerRef}>
                <svg
                    ref={svgRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    className="bubble-chart-svg"
                />

                {/* Tooltip */}
                {tooltip.data && (
                    <div
                        className="bubble-tooltip"
                        style={{
                            left: tooltip.x,
                            top: tooltip.y,
                            transform: 'translate(-50%, -100%)'
                        }}
                    >
                        <div className="tooltip-name">{tooltip.data.name}</div>
                        <div className={`tooltip-value ${tooltip.data.hasAccess ? 'access' : 'denied'}`}>
                            {tooltip.data.hasAccess
                                ? `${tooltip.data.value} unit${tooltip.data.value !== 1 ? 's' : ''}`
                                : 'No access'
                            }
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
