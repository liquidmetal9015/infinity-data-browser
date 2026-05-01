import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import type { WoundPipelineDataPoint } from '../../utils/dice-analytics';

interface WoundPipelineChartProps {
    data: WoundPipelineDataPoint[];
}

export function WoundPipelineChart({ data }: WoundPipelineChartProps) {
    return (
        <div className="analytics-chart-container">
            <h3>Wound Distribution Pipeline</h3>
            <p className="chart-description">
                Displays the final expected distribution of wounds after both F2F resolution and Armor Saves.
                Notice the heavy weighting toward zero wounds ("No Hits / Draw" and "Saved Hits").
            </p>
            <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} margin={{ top: 20, right: 30, left: 40, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                            dataKey="category"
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                        />
                        <YAxis
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickFormatter={(val) => `${val}%`}
                            domain={[0, 100]}
                            label={{ value: 'Probability', angle: -90, position: 'insideLeft', offset: -20, fill: '#94a3b8' }}
                        />
                        <Tooltip
                            formatter={(value: number | string) => [`${Number(value).toFixed(1)}%`, '']}
                            contentStyle={{ backgroundColor: 'var(--color-bg-secondary)', border: 'none', borderRadius: '4px' }}
                            cursor={{ fill: 'var(--color-bg-secondary)', opacity: 0.4 }}
                        />
                        <Legend verticalAlign="top" height={36} />
                        <Bar dataKey="activeProbability" name="Active Inflicts" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="reactiveProbability" name="Reactive Inflicts" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
