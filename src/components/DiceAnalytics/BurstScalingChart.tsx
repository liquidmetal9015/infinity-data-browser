import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import type { BurstScalingDataPoint } from '../../utils/dice-analytics';

interface BurstScalingChartProps {
    data: BurstScalingDataPoint[];
}

export function BurstScalingChart({ data }: BurstScalingChartProps) {
    return (
        <div className="analytics-chart-container">
            <h3>Burst Scaling Curve</h3>
            <p className="chart-description">
                Illustrates the probability of the Active player winning the F2F roll as their Burst increases from 1 to 6
                (against a B1 defender). Notice the diminishing returns at high bursts.
            </p>
            <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                    <LineChart data={data} margin={{ top: 20, right: 30, left: 40, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                            dataKey="burst"
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            label={{ value: 'Active Burst', position: 'insideBottom', offset: -25, fill: '#94a3b8' }}
                        />
                        <YAxis
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickFormatter={(val) => `${val}%`}
                            domain={[0, 100]}
                            label={{ value: 'Active Win Probability', angle: -90, position: 'insideLeft', offset: -20, fill: '#94a3b8' }}
                        />
                        <Tooltip
                            formatter={(value: any) => [`${Number(value).toFixed(1)}%`, '']} // Updated formatter
                            contentStyle={{ backgroundColor: 'var(--color-bg-secondary)', border: 'none', borderRadius: '4px' }}
                        />
                        <Legend verticalAlign="top" height={36} />
                        <Line type="monotone" dataKey="favorable" name="Favorable (SV15 vs 10)" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="even" name="Even (SV12 vs 12)" stroke="#f59e0b" strokeWidth={2} />
                        <Line type="monotone" dataKey="unfavorable" name="Unfavorable (SV10 vs 15)" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
