// Visual Bar Graph for wounds distribution

interface WoundsDistribution {
    wounds: Map<number, number>;
}

interface WoundsBarProps {
    active: WoundsDistribution;
    reactive: WoundsDistribution;
    fail: number;
}

interface Segment {
    w: number;
    p: number;
    type: string;
}

export const WoundsBar = ({ active, reactive, fail }: WoundsBarProps) => {
    const getSegs = (wounds: Map<number, number>, type: string): Segment[] =>
        Array.from(wounds.entries())
            .filter(([w, p]) => w > 0 && p > 0.001)
            .sort((a, b) => b[0] - a[0])
            .map(([w, p]) => ({ w, p, type }));

    const aSegs = getSegs(active.wounds, 'active');
    const rSegs = getSegs(reactive.wounds, 'reactive').reverse();

    return (
        <div className="wounds-bar-container">
            <div className="wounds-bar">
                {aSegs.map(s => (
                    <div
                        key={`a${s.w}`}
                        className={`bar-seg seg-active seg-w${Math.min(s.w, 5)}`}
                        style={{ width: `${s.p * 100}%` }}
                        title={`Active: ${s.w} wounds (${(s.p * 100).toFixed(1)}%)`}
                    >
                        {s.p > 0.08 && <span>{s.w}</span>}
                    </div>
                ))}
                {fail > 0.01 && (
                    <div
                        className="bar-seg seg-fail"
                        style={{ width: `${fail * 100}%` }}
                        title={`No result (${(fail * 100).toFixed(1)}%)`}
                    />
                )}
                {rSegs.map(s => (
                    <div
                        key={`r${s.w}`}
                        className={`bar-seg seg-reactive seg-w${Math.min(s.w, 5)}`}
                        style={{ width: `${s.p * 100}%` }}
                        title={`Reactive: ${s.w} wounds (${(s.p * 100).toFixed(1)}%)`}
                    >
                        {s.p > 0.08 && <span>{s.w}</span>}
                    </div>
                ))}
            </div>
        </div>
    );
};
