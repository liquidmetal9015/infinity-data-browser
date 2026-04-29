import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import type { F2FHeatmapDataPoint } from '../../utils/dice-analytics';

interface F2FHeatmapChartProps {
    data: F2FHeatmapDataPoint[];
    activeBurst: number;
    reactiveBurst: number;
}

export function F2FHeatmapChart({ data, activeBurst, reactiveBurst }: F2FHeatmapChartProps) {
    // We use a ScatterChart in recharts as a proxy for a Heatmap. 
    // The Z-axis controls the radius, mapped to the Win Probability.
    return (
        <div className="analytics-chart-container">
            <h3>F2F Win Probability Surface (B{activeBurst} vs B{reactiveBurst})</h3>
            <p className="chart-description">
                A 2D projection of the engagement space. The X-axis is the Active player's SV, the Y-axis is the Reactive player's SV.
                Larger dots represent higher probabilities of the Active player winning the F2F roll.
            </p>
            <div style={{ width: '100%', height: 500 }}>
                <ResponsiveContainer>
                    <ScatterChart margin={{ top: 20, right: 30, left: 50, bottom: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                            dataKey="activeSV"
                            type="number"
                            name="Active SV"
                            tickCount={20}
                            domain={[1, 20]}
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                            label={{ value: 'Active SV', position: 'insideBottom', offset: -35, fill: '#94a3b8' }}
                        />
                        <YAxis
                            dataKey="reactiveSV"
                            type="number"
                            name="Reactive SV"
                            tickCount={20}
                            domain={[1, 20]}
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                            label={{ value: 'Reactive SV', angle: -90, position: 'insideLeft', offset: -35, fill: '#94a3b8' }}
                        />
                        <ZAxis
                            dataKey="activeWinProb"
                            type="number"
                            range={[10, 400]}
                            name="Active Win Prob"
                        />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            formatter={(value: number | string, name: string) => {
                                if (name === 'Active Win Prob') return [`${Number(value).toFixed(1)}%`, name];
                                return [value, name];
                            }}
                            contentStyle={{ backgroundColor: 'var(--color-bg-secondary)', border: 'none', borderRadius: '4px' }}
                        />
                        <Scatter data={data} fill="#8884d8" fillOpacity={0.6} />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
