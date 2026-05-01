
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
import type { MaxOfNDataPoint } from '../../utils/dice-analytics';

interface MaxOfNChartProps {
    data: MaxOfNDataPoint[];
    sv: number;
}

export function MaxOfNChart({ data, sv }: MaxOfNChartProps) {
    return (
        <div className="analytics-chart-container">
            <h3>Max-of-N Probability Distribution (SV {sv})</h3>
            <p className="chart-description">
                Shows the probability of your <em>highest</em> successful roll matching each value on the d20.
                Notice how higher burst pushes the distribution mass immediately to the right, closer to the SV threshold.
            </p>
            <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={data} margin={{ top: 20, right: 30, left: 40, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                            dataKey="rollValue"
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            minTickGap={10}
                            label={{ value: 'Highest Successful Roll', position: 'insideBottom', offset: -25, fill: '#94a3b8' }}
                        />
                        <YAxis
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            tickFormatter={(val) => `${val}%`}
                            label={{ value: 'Probability', angle: -90, position: 'insideLeft', offset: -20, fill: '#94a3b8' }}
                        />
                        <Tooltip
                            formatter={(value: number | string) => [`${Number(value).toFixed(1)}%`, '']}
                            contentStyle={{ backgroundColor: 'var(--color-bg-secondary)', border: 'none', borderRadius: '4px' }}
                        />
                        <Legend verticalAlign="top" height={36} />
                        <Line type="monotone" dataKey="burst1" name="Burst 1" stroke="#8884d8" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="burst2" name="Burst 2" stroke="#82ca9d" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="burst3" name="Burst 3" stroke="#ffc658" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="burst4" name="Burst 4" stroke="#ff7300" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
