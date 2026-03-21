import { useMemo } from 'react';
import { useDiceCalcStore } from '../stores/useDiceCalcStore';
import {
    MaxOfNChart,
    BurstScalingChart,
    WoundPipelineChart,
    F2FHeatmapChart
} from '../components/DiceAnalytics';
import {
    generateMaxOfNData,
    generateHeatmapData,
    generateBurstScalingData,
    generateWoundPipelineData
} from '../utils/dice-analytics';
import './DiceCalculatorPage.css'; // Reuse calculator styles for input panels

export function DiceAnalyticsPage() {
    // Pull the exact same state as the Dice Calculator so they are perfectly synced
    const { activeParams, reactiveParams } = useDiceCalcStore();

    // Recompute data only when the inputs actually change
    const maxOfNData = useMemo(() => generateMaxOfNData(activeParams.sv), [activeParams.sv]);

    const burstScalingData = useMemo(() => generateBurstScalingData(reactiveParams.burst), [reactiveParams.burst]);

    const heatmapData = useMemo(() =>
        generateHeatmapData(activeParams.burst, reactiveParams.burst),
        [activeParams.burst, reactiveParams.burst]
    );

    const woundPipelineData = useMemo(() =>
        generateWoundPipelineData(
            activeParams.burst, activeParams.sv, activeParams.damage, activeParams.ammo, activeParams.continuous, activeParams.critImmune,
            reactiveParams.burst, reactiveParams.sv, reactiveParams.damage, reactiveParams.ammo, reactiveParams.continuous, reactiveParams.critImmune,
            activeParams.armor, reactiveParams.armor, activeParams.bts, reactiveParams.bts
        ),
        [activeParams, reactiveParams]
    );

    return (
        <div className="dice-analytics-page p-6 w-full h-full overflow-y-auto bg-[var(--bg-primary)]">
            <header className="mb-8 border-b border-[var(--border)] pb-4">
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                    Infinity Dice Analytics
                </h2>
                <p className="text-[var(--text-secondary)]">
                    Interactive visualizations covering the Face-to-Face mathematical engine.
                    These charts automatically update as you change the inputs in the Dice Calculator tab.
                </p>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Upper Left: Max of N */}
                <div className="chart-card bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border)] shadow-sm">
                    <MaxOfNChart data={maxOfNData} sv={activeParams.sv} />
                </div>

                {/* Upper Right: Wound Pipeline */}
                <div className="chart-card bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border)] shadow-sm">
                    <WoundPipelineChart data={woundPipelineData} />
                </div>

                {/* Lower Left: Burst Scaling */}
                <div className="chart-card bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border)] shadow-sm">
                    <BurstScalingChart data={burstScalingData} />
                </div>

                {/* Lower Right: F2F Surface Heatmap */}
                <div className="chart-card bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border)] shadow-sm">
                    <F2FHeatmapChart
                        data={heatmapData}
                        activeBurst={activeParams.burst}
                        reactiveBurst={reactiveParams.burst}
                    />
                </div>
            </div>

            <div className="mt-8 text-sm text-[var(--text-dim)] text-center">
                Visualizing data for B{activeParams.burst} SV{activeParams.sv} {activeParams.ammo} ({activeParams.damage})
                vs B{reactiveParams.burst} SV{reactiveParams.sv} {reactiveParams.ammo} ({reactiveParams.damage})
            </div>
        </div>
    );
}
