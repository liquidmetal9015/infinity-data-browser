// Dice Calculator Page - Main component
import { useDiceCalculator } from '../hooks/useDiceCalculator';
import { Swords, Shield, ArrowLeftRight, Zap } from 'lucide-react';
import {
    CompactNumber,
    BurstSelector,
    AmmoSelector,
    PresetsBar,
    ComparisonSummary,
    WoundsTable,
    WoundsBar,
    type WeaponPreset,
    type ArmorPreset
} from '../components/DiceCalculator';
import './DiceCalculatorPage.css';

export function DiceCalculatorPage() {
    const { activeParams, reactiveParams, setActiveParams, setReactiveParams, results } = useDiceCalculator();

    const updateActive = (field: string, val: any) => setActiveParams({ ...activeParams, [field]: val });
    const updateReactive = (field: string, val: any) => setReactiveParams({ ...reactiveParams, [field]: val });

    const swap = () => {
        const temp = { ...activeParams };
        setActiveParams({ ...reactiveParams });
        setReactiveParams({ ...temp });
    };

    const applyWeaponToActive = (preset: WeaponPreset) => {
        setActiveParams({ ...activeParams, damage: preset.ps, ammo: preset.ammo, burst: preset.burst });
    };

    const applyArmorToReactive = (preset: ArmorPreset) => {
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
