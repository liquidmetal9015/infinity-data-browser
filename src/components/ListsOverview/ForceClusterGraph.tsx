import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { ArmyList } from '@shared/listTypes';

interface GraphNode extends d3.SimulationNodeDatum {
    id: string;
    name: string;
    factionShortName: string;
    superFactionId: number;
    points: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    similarity: number;
}

interface Props {
    lists: ArmyList[];
    matrix: number[][];
    /** Edges with similarity below this aren't drawn. */
    threshold: number;
    factionShortName: (factionId: number) => string;
    superFactionIdOf: (factionId: number) => number;
    onPick: (listId: string) => void;
}

const PALETTE = [
    '#6366f1', '#F29107', '#10b981', '#ef4444', '#a855f7',
    '#06b6d4', '#f59e0b', '#84cc16', '#ec4899', '#14b8a6',
    '#8b5cf6', '#22c55e', '#fb7185', '#0ea5e9', '#f97316',
];

function colorForSuperFaction(id: number): string {
    return PALETTE[Math.abs(id) % PALETTE.length];
}

export function ForceClusterGraph({ lists, matrix, threshold, factionShortName, superFactionIdOf, onPick }: Props) {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dim, setDim] = useState({ w: 900, h: 520 });

    // Resize observer — make the SVG fluid in width.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            for (const e of entries) {
                const w = Math.max(400, Math.floor(e.contentRect.width));
                setDim(d => (d.w === w ? d : { ...d, w }));
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const { nodes, links, legend } = useMemo(() => {
        const ns: GraphNode[] = lists.map(l => ({
            id: l.id,
            name: l.name,
            factionShortName: factionShortName(l.factionId),
            superFactionId: superFactionIdOf(l.factionId),
            points: l.pointsLimit || 300,
        }));
        const ls: GraphLink[] = [];
        for (let i = 0; i < lists.length; i++) {
            for (let j = i + 1; j < lists.length; j++) {
                if (matrix[i][j] >= threshold) {
                    ls.push({ source: lists[i].id, target: lists[j].id, similarity: matrix[i][j] });
                }
            }
        }
        const legendMap = new Map<number, string>();
        for (const n of ns) {
            if (!legendMap.has(n.superFactionId)) legendMap.set(n.superFactionId, n.factionShortName);
        }
        const legendItems = Array.from(legendMap.entries()).map(([id, name]) => ({
            id, name, color: colorForSuperFaction(id),
        }));
        return { nodes: ns, links: ls, legend: legendItems };
    }, [lists, matrix, threshold, factionShortName, superFactionIdOf]);

    useEffect(() => {
        const svg = d3.select(svgRef.current!);
        svg.selectAll('*').remove();
        if (nodes.length === 0) return;

        const width = dim.w;
        const height = dim.h;

        const radius = (n: GraphNode) => Math.max(6, Math.sqrt(n.points) * 1.4);

        // We feed copies into the simulation so re-renders don't carry old positions.
        const simNodes: GraphNode[] = nodes.map(n => ({ ...n }));
        const idToNode = new Map(simNodes.map(n => [n.id, n]));
        const simLinks: GraphLink[] = links
            .map(l => ({
                source: idToNode.get(l.source as string)!,
                target: idToNode.get(l.target as string)!,
                similarity: l.similarity,
            }))
            .filter(l => l.source && l.target);

        const sim = d3.forceSimulation<GraphNode>(simNodes)
            .force('link', d3.forceLink<GraphNode, GraphLink>(simLinks)
                .id(d => d.id)
                // Higher similarity → shorter ideal distance, stronger pull.
                .distance(l => 60 + (1 - l.similarity) * 140)
                .strength(l => 0.2 + l.similarity * 0.8)
            )
            .force('charge', d3.forceManyBody<GraphNode>().strength(-180))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide<GraphNode>().radius(d => radius(d) + 6));

        const linkSel = svg.append('g')
            .attr('stroke-linecap', 'round')
            .selectAll('line')
            .data(simLinks)
            .enter().append('line')
            .attr('stroke', '#64748b')
            .attr('stroke-opacity', d => 0.15 + d.similarity * 0.55)
            .attr('stroke-width', d => 0.5 + d.similarity * 2.5);

        const nodeG = svg.append('g')
            .selectAll('g')
            .data(simNodes)
            .enter().append('g')
            .style('cursor', 'pointer')
            .on('click', (_, d) => onPick(d.id));

        nodeG.append('circle')
            .attr('r', d => radius(d))
            .attr('fill', d => colorForSuperFaction(d.superFactionId))
            .attr('fill-opacity', 0.75)
            .attr('stroke', '#0f172a')
            .attr('stroke-width', 1.5);

        nodeG.append('title')
            .text(d => `${d.name} · ${d.factionShortName} · ${d.points}pts`);

        nodeG.append('text')
            .text(d => d.name.length > 18 ? d.name.slice(0, 17) + '…' : d.name)
            .attr('text-anchor', 'middle')
            .attr('dy', d => radius(d) + 12)
            .attr('font-size', 11)
            .attr('fill', '#cbd5e1')
            .style('pointer-events', 'none')
            .style('paint-order', 'stroke')
            .attr('stroke', '#0f172a')
            .attr('stroke-width', 3)
            .attr('stroke-opacity', 0.55);

        sim.on('tick', () => {
            linkSel
                .attr('x1', d => (d.source as GraphNode).x ?? 0)
                .attr('y1', d => (d.source as GraphNode).y ?? 0)
                .attr('x2', d => (d.target as GraphNode).x ?? 0)
                .attr('y2', d => (d.target as GraphNode).y ?? 0);
            nodeG.attr('transform', d => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
        });

        const drag = d3.drag<SVGGElement, GraphNode>()
            .on('start', (event, d) => {
                if (!event.active) sim.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x; d.fy = event.y;
            })
            .on('end', (event) => {
                if (!event.active) sim.alphaTarget(0);
                // Leave fx/fy in place — pinned where the user dropped it.
            });
        nodeG.call(drag);

        return () => { sim.stop(); };
    }, [nodes, links, dim.w, dim.h, onPick]);

    return (
        <div ref={containerRef} style={{ width: '100%' }}>
            <svg ref={svgRef} width={dim.w} height={dim.h} style={{ display: 'block' }} />
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.85rem',
                marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-tertiary, #64748b)',
            }}>
                {legend.map(l => (
                    <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: l.color, display: 'inline-block',
                        }} />
                        {l.name}
                    </span>
                ))}
                <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary, #64748b)' }}>
                    Drag to rearrange · Click a node for "similar to" view
                </span>
            </div>
        </div>
    );
}
