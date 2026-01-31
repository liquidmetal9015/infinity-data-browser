// Comparison Summary showing win probabilities
import { Swords, Shield } from 'lucide-react';

interface SideResult {
    winProbability: number;
    expectedWounds: number;
}

interface ComparisonSummaryProps {
    active: SideResult;
    reactive: SideResult;
    fail: number;
}

export const ComparisonSummary = ({ active, reactive, fail }: ComparisonSummaryProps) => {
    const activeWin = active.winProbability;
    const reactiveWin = reactive.winProbability;

    const diff = activeWin - reactiveWin;
    const favoredSide = diff > 0.01 ? 'Active' : diff < -0.01 ? 'Reactive' : 'Even';
    const favoredPercent = Math.abs(diff * 100).toFixed(1);

    return (
        <div className="comparison-summary">
            <div className={`summary-side active-side ${favoredSide === 'Active' ? 'favored' : ''}`}>
                <Swords size={20} />
                <div className="summary-stats">
                    <span className="summary-pct">{(activeWin * 100).toFixed(1)}%</span>
                    <span className="summary-label">Active Wins</span>
                </div>
                <span className="summary-wounds">Avg: {active.expectedWounds.toFixed(2)} wounds</span>
            </div>

            <div className="summary-center">
                {favoredSide !== 'Even' ? (
                    <>
                        <span className="favor-arrow">{favoredSide === 'Active' ? '←' : '→'}</span>
                        <span className="favor-text">{favoredSide} +{favoredPercent}%</span>
                    </>
                ) : (
                    <span className="favor-text">Even Odds</span>
                )}
                <span className="fail-text">Fail: {(fail * 100).toFixed(1)}%</span>
            </div>

            <div className={`summary-side reactive-side ${favoredSide === 'Reactive' ? 'favored' : ''}`}>
                <Shield size={20} />
                <div className="summary-stats">
                    <span className="summary-pct">{(reactiveWin * 100).toFixed(1)}%</span>
                    <span className="summary-label">Reactive Wins</span>
                </div>
                <span className="summary-wounds">Avg: {reactive.expectedWounds.toFixed(2)} wounds</span>
            </div>
        </div>
    );
};
