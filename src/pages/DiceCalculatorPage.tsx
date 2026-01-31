import { useDiceCalculator } from '../hooks/useDiceCalculator';
import { Swords, Shield, ArrowLeftRight, Plus, Minus, Zap } from 'lucide-react';
import './DiceCalculatorPage.css';

// ----------------------------------------------------------------------------
// Weapon Presets
// ----------------------------------------------------------------------------
const WEAPON_PRESETS = [
    { name: 'Combi', sv: 0, ps: 13, ammo: 'N', burst: 3 },
    { name: 'Rifle', sv: 0, ps: 13, ammo: 'N', burst: 3 },
    { name: 'HMG', sv: 0, ps: 15, ammo: 'N', burst: 4 },
    { name: 'Spitfire', sv: 0, ps: 14, ammo: 'N', burst: 4 },
    { name: 'Sniper', sv: 0, ps: 15, ammo: 'DA', burst: 2 },
    { name: 'Missile', sv: 0, ps: 14, ammo: 'EXP', burst: 2 },
    { name: 'Pistol', sv: 0, ps: 11, ammo: 'N', burst: 2 },
];

const ARMOR_PRESETS = [
    { name: 'LI', armor: 0 },
    { name: 'MI', armor: 2 },
    { name: 'HI', armor: 4 },
    { name: 'TAG', armor: 7 },
];

// ----------------------------------------------------------------------------
// Compact Number Input with +/- buttons
// ----------------------------------------------------------------------------
const CompactNumber = ({
    label,
    value,
    onChange,
    min = 0,
    max = 25,
    showZero = false
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    showZero?: boolean;
}) => (
    <div className="compact-input">
        <span className="compact-label">{label}</span>
        <div className="compact-controls">
            <button
                className="compact-btn"
                onClick={() => onChange(Math.max(min, value - 1))}
                disabled={value <= min}
            >
                <Minus size={14} />
            </button>
            <input
                type="number"
                className="compact-value"
                value={value}
                onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
            />
            <button
                className="compact-btn"
                onClick={() => onChange(Math.min(max, value + 1))}
                disabled={value >= max}
            >
                <Plus size={14} />
            </button>
            {showZero && (
                <button
                    className="compact-btn zero-btn"
                    onClick={() => onChange(0)}
                    title="Set to 0"
                >
                    0
                </button>
            )}
        </div>
    </div>
);

// ----------------------------------------------------------------------------
// Burst Widget with Visual Dots
// ----------------------------------------------------------------------------
const BurstSelector = ({ value, onChange, isReactive = false }: any) => (
    <div className="burst-selector">
        <span className="compact-label">Burst</span>
        <div className="burst-buttons">
            {isReactive && (
                <button
                    className={`burst-btn ${value === 0 ? 'active' : ''}`}
                    onClick={() => onChange(0)}
                >
                    0
                </button>
            )}
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    className={`burst-btn ${value === n ? 'active' : ''}`}
                    onClick={() => onChange(n)}
                >
                    {n}
                </button>
            ))}
        </div>
    </div>
);

// ----------------------------------------------------------------------------
// Ammo Toggle Chips
// ----------------------------------------------------------------------------
const AMMO_LIST = ['N', 'DA', 'EXP', 'T2', 'PLASMA'];

const AmmoSelector = ({ ammo, continuous, critImmune, onUpdate }: any) => (
    <div className="ammo-selector">
        <div className="ammo-row">
            {AMMO_LIST.map(a => (
                <button
                    key={a}
                    className={`ammo-btn ${ammo === a ? 'active' : ''}`}
                    onClick={() => onUpdate('ammo', a)}
                >
                    {a}
                </button>
            ))}
        </div>
        <div className="ammo-toggles">
            <button
                className={`toggle-btn ${continuous ? 'active' : ''}`}
                onClick={() => onUpdate('continuous', !continuous)}
            >
                CONT
            </button>
            <button
                className={`toggle-btn ${critImmune ? 'active' : ''}`}
                onClick={() => onUpdate('critImmune', !critImmune)}
            >
                CRIT IMMUNE
            </button>
        </div>
    </div>
);

// ----------------------------------------------------------------------------
// Presets Bar
// ----------------------------------------------------------------------------
const PresetsBar = ({ onApplyWeapon, onApplyArmor }: any) => (
    <div className="presets-bar">
        <div className="preset-group">
            <span className="preset-label">Weapons:</span>
            {WEAPON_PRESETS.map(p => (
                <button
                    key={p.name}
                    className="preset-chip"
                    onClick={() => onApplyWeapon(p)}
                    title={`PS ${p.ps}, ${p.ammo}, B${p.burst}`}
                >
                    {p.name}
                </button>
            ))}
        </div>
        <div className="preset-group">
            <span className="preset-label">Armor:</span>
            {ARMOR_PRESETS.map(p => (
                <button
                    key={p.name}
                    className="preset-chip armor-chip"
                    onClick={() => onApplyArmor(p)}
                    title={`ARM ${p.armor}`}
                >
                    {p.name}
                </button>
            ))}
        </div>
    </div>
);

// ----------------------------------------------------------------------------
// Results: Comparison Summary
// ----------------------------------------------------------------------------
const ComparisonSummary = ({ active, reactive, fail }: any) => {
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

// ----------------------------------------------------------------------------
// Results: Wounds Distribution Table
// ----------------------------------------------------------------------------
const WoundsTable = ({ active, reactive }: any) => {
    // Build cumulative data
    const buildRows = (wounds: Map<number, number>) => {
        const entries = Array.from(wounds.entries())
            .filter(([w]) => w >= 0)
            .sort((a, b) => a[0] - b[0]);

        let cumulative = 0;
        const rows = [];
        for (const [w, p] of entries) {
            cumulative += p;
            rows.push({ wounds: w, prob: p, cumulative: 1 - (cumulative - p) }); // P(>=w)
        }
        return rows;
    };

    const activeRows = buildRows(active.wounds);
    const reactiveRows = buildRows(reactive.wounds);

    return (
        <div className="wounds-tables">
            <div className="wounds-table">
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
                            <tr key={r.wounds} className={r.wounds > 0 ? 'wound-row' : ''}>
                                <td>{r.wounds}</td>
                                <td>{(r.prob * 100).toFixed(1)}%</td>
                                <td>{(r.cumulative * 100).toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="wounds-table">
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
                            <tr key={r.wounds} className={r.wounds > 0 ? 'wound-row' : ''}>
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

// ----------------------------------------------------------------------------
// Visual Bar Graph
// ----------------------------------------------------------------------------
const WoundsBar = ({ active, reactive, fail }: any) => {
    const getSegs = (wounds: Map<number, number>, type: string) =>
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

// ----------------------------------------------------------------------------
// Main Page
// ----------------------------------------------------------------------------
export function DiceCalculatorPage() {
    const { activeParams, reactiveParams, setActiveParams, setReactiveParams, results } = useDiceCalculator();

    const updateActive = (field: string, val: any) => setActiveParams({ ...activeParams, [field]: val });
    const updateReactive = (field: string, val: any) => setReactiveParams({ ...reactiveParams, [field]: val });

    const swap = () => {
        const temp = { ...activeParams };
        setActiveParams({ ...reactiveParams });
        setReactiveParams({ ...temp });
    };

    const applyWeaponToActive = (preset: any) => {
        setActiveParams({ ...activeParams, damage: preset.ps, ammo: preset.ammo, burst: preset.burst });
    };

    const applyArmorToReactive = (preset: any) => {
        setReactiveParams({ ...reactiveParams, armor: preset.armor });
    };

    return (
        <div className="dice-calculator-page">
            <div className="page-header">
                <h2><Zap size={24} /> N5 Dice Calculator</h2>
            </div>

            {/* Presets */}
            <PresetsBar
                onApplyWeapon={applyWeaponToActive}
                onApplyArmor={applyArmorToReactive}
            />

            {/* Results Section */}
            {results && (
                <div className="results-section">
                    <ComparisonSummary
                        active={results.active}
                        reactive={results.reactive}
                        fail={results.failProbability}
                    />

                    <WoundsBar
                        active={results.active}
                        reactive={results.reactive}
                        fail={results.failProbability}
                    />

                    <WoundsTable
                        active={results.active}
                        reactive={results.reactive}
                    />
                </div>
            )}

            {/* Input Panels */}
            <div className="input-panels">
                <button className="swap-btn" onClick={swap} title="Swap">
                    <ArrowLeftRight size={18} />
                </button>

                {/* Active Panel */}
                <div className="input-panel active-panel">
                    <div className="panel-header">
                        <Swords size={18} /> <span>Active</span>
                    </div>

                    <div className="panel-row">
                        <CompactNumber label="BS" value={activeParams.sv} onChange={v => updateActive('sv', v)} />
                        <CompactNumber label="PS" value={activeParams.damage} onChange={v => updateActive('damage', v)} />
                        <CompactNumber label="ARM" value={activeParams.armor} onChange={v => updateActive('armor', v)} />
                    </div>

                    <BurstSelector
                        value={activeParams.burst}
                        onChange={(v: number) => updateActive('burst', v)}
                    />

                    <AmmoSelector
                        ammo={activeParams.ammo}
                        continuous={activeParams.continuous}
                        critImmune={activeParams.critImmune}
                        onUpdate={updateActive}
                    />
                </div>

                {/* Reactive Panel */}
                <div className="input-panel reactive-panel">
                    <div className="panel-header">
                        <Shield size={18} /> <span>Reactive</span>
                    </div>

                    <div className="panel-row">
                        <CompactNumber label="BS" value={reactiveParams.sv} onChange={v => updateReactive('sv', v)} />
                        <CompactNumber label="PS" value={reactiveParams.damage} onChange={v => updateReactive('damage', v)} />
                        <CompactNumber label="ARM" value={reactiveParams.armor} onChange={v => updateReactive('armor', v)} />
                    </div>

                    <BurstSelector
                        value={reactiveParams.burst}
                        onChange={(v: number) => updateReactive('burst', v)}
                        isReactive={true}
                    />

                    <AmmoSelector
                        ammo={reactiveParams.ammo}
                        continuous={reactiveParams.continuous}
                        critImmune={reactiveParams.critImmune}
                        onUpdate={updateReactive}
                    />
                </div>
            </div>
        </div>
    );
}
