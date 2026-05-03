// Wounds Distribution Table
import styles from './WoundsTable.module.css';

interface WoundsDistribution {
    wounds: Map<number, number>;
}

interface WoundsTableProps {
    active: WoundsDistribution;
    reactive: WoundsDistribution;
}

interface WoundsRow {
    wounds: number;
    prob: number;
    cumulative: number;
}

export const WoundsTable = ({ active, reactive }: WoundsTableProps) => {
    // Build cumulative data
    const buildRows = (wounds: Map<number, number>): WoundsRow[] => {
        const entries = Array.from(wounds.entries())
            .filter(([w]) => w >= 0)
            .sort((a, b) => a[0] - b[0]);

        let cumulative = 0;
        const rows: WoundsRow[] = [];
        for (const [w, p] of entries) {
            cumulative += p;
            rows.push({ wounds: w, prob: p, cumulative: 1 - (cumulative - p) }); // P(>=w)
        }
        return rows;
    };

    const activeRows = buildRows(active.wounds);
    const reactiveRows = buildRows(reactive.wounds);

    return (
        <div className={styles.woundsTables}>
            <div className={styles.woundsTable}>
                <h4>Active Wounds Distribution</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Wounds</th>
                            <th>Probability</th>
                            <th>≥ This</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeRows.map(r => (
                            <tr key={r.wounds} className={r.wounds > 0 ? styles.woundRow : ''}>
                                <td>{r.wounds}</td>
                                <td>{(r.prob * 100).toFixed(1)}%</td>
                                <td>{(r.cumulative * 100).toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={styles.woundsTable}>
                <h4>Reactive Wounds Distribution</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Wounds</th>
                            <th>Probability</th>
                            <th>≥ This</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reactiveRows.map(r => (
                            <tr key={r.wounds} className={r.wounds > 0 ? styles.woundRow : ''}>
                                <td>{r.wounds}</td>
                                <td>{(r.prob * 100).toFixed(1)}%</td>
                                <td>{(r.cumulative * 100).toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
