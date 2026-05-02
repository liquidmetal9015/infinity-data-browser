// Dice Calculator Page - Main component
// State is managed by useDiceCalcStore (Zustand) for persistence
// Computation logic from useDiceCalculator hook
import { useState } from 'react';
import { clsx } from 'clsx';
import { useDiceCalculator, type PlayerParams } from '../hooks/useDiceCalculator';
import { Swords, Shield, ArrowLeftRight } from 'lucide-react';
import {
    CompactNumber,
    BurstSelector,
    AmmoSelector,
    ComparisonSummary,
    WoundsTable,
    WoundsBar,
    WeaponSelector,
    CalculatorUnitSelector,
    CalculatorProfileSelector
} from '../components/DiceCalculator';
import type { WeaponProfile } from '../components/DiceCalculator/types';
import type { ParsedWeapon, Unit, Profile } from '../../shared/types';
import type { Loadout as Option } from '../../shared/game-model';
import { useDiceCalcStore } from '../stores/useDiceCalcStore';
import styles from './DiceCalculatorPage.module.css';

export function DiceCalculatorPage() {
    // Persisted state from Zustand store
    const {
        mode, distance, activeParams, reactiveParams,
        setMode, setDistance, setActiveParams, setReactiveParams,
        updateActive, updateReactive, swap,
    } = useDiceCalcStore();

    // Non-persisted unit selection state (large objects, not serializable)
    const [activeUnit, setActiveUnit] = useState<Unit | undefined>();
    const [activeProfile, setActiveProfile] = useState<Profile | undefined>();
    const [activeOption, setActiveOption] = useState<Option | undefined>();
    const [reactiveUnit, setReactiveUnit] = useState<Unit | undefined>();
    const [reactiveProfile, setReactiveProfile] = useState<Profile | undefined>();
    const [reactiveOption, setReactiveOption] = useState<Option | undefined>();

    // Build full PlayerParams by merging store params with local unit objects
    const fullActiveParams: PlayerParams = {
        ...activeParams,
        selectedUnit: activeUnit,
        selectedProfile: activeProfile,
        selectedOption: activeOption,
    };
    const fullReactiveParams: PlayerParams = {
        ...reactiveParams,
        selectedUnit: reactiveUnit,
        selectedProfile: reactiveProfile,
        selectedOption: reactiveOption,
    };

    // Computation (pure, from hook)
    const results = useDiceCalculator(mode, fullActiveParams, fullReactiveParams, distance);

    const RANGE_BANDS = [
        { label: '0-8"', value: 8 },
        { label: '8-16"', value: 16 },
        { label: '16-24"', value: 24 },
        { label: '24-32"', value: 32 },
        { label: '32-48"', value: 48 },
        { label: '48-96"', value: 96 }
    ];

    const parseAmmo = (ammunition: string) => {
        const upper = ammunition.toUpperCase();
        const ap = upper.includes('AP');

        // Find base ammo
        let baseAmmo = 'N';
        if (upper.includes('PLASMA')) baseAmmo = 'PLASMA';
        else if (upper.includes('EXP')) baseAmmo = 'EXP';
        else if (upper.includes('DA')) baseAmmo = 'DA';
        else if (upper.includes('T2')) baseAmmo = 'T2';

        return { ap, baseAmmo };
    };

    const applyWeaponToActive = (weapon: ParsedWeapon, profile: WeaponProfile) => {
        const { ap, baseAmmo } = parseAmmo(profile.ammo[0] || 'N');
        setActiveParams({
            ...activeParams,
            damage: parseInt(profile.damage) || 13,
            ammo: baseAmmo,
            burst: profile.burst,
            ap,
            weaponBands: profile.bands,
            selectedWeapon: weapon.name
        });
    };

    const handleActiveUnitSelect = (unit: Unit | undefined) => {
        setActiveUnit(unit);
        setActiveProfile(undefined);
        setActiveOption(undefined);
        setActiveParams({
            ...activeParams,
            selectedWeapon: undefined
        });
    };

    const handleActiveProfileSelect = (profile: Profile, option: Option) => {
        setActiveProfile(profile);
        setActiveOption(option);
        setActiveParams({
            ...activeParams,
            sv: profile.bs,
            armor: profile.arm,
            bts: profile.bts,
            selectedWeapon: undefined
        });
    };

    const applyWeaponToReactive = (weapon: ParsedWeapon, profile: WeaponProfile) => {
        const { ap, baseAmmo } = parseAmmo(profile.ammo[0] || 'N');
        setReactiveParams({
            ...reactiveParams,
            damage: parseInt(profile.damage) || 13,
            ammo: baseAmmo,
            burst: 1, // Default to ARO burst 1
            ap,
            weaponBands: profile.bands,
            selectedWeapon: weapon.name
        });
    };

    const handleReactiveUnitSelect = (unit: Unit | undefined) => {
        setReactiveUnit(unit);
        setReactiveProfile(undefined);
        setReactiveOption(undefined);
        setReactiveParams({
            ...reactiveParams,
            selectedWeapon: undefined
        });
    };

    const handleReactiveProfileSelect = (profile: Profile, option: Option) => {
        setReactiveProfile(profile);
        setReactiveOption(option);
        setReactiveParams({
            ...reactiveParams,
            sv: profile.bs,
            armor: profile.arm,
            bts: profile.bts,
            selectedWeapon: undefined
        });
    };

    const computeEffectiveSv = (params: import('../hooks/useDiceCalculator').PlayerParams, distanceInches: number, opponentHasCover: boolean) => {
        let sv = params.sv;
        if (params.weaponBands && params.weaponBands.length > 0) {
            const band = params.weaponBands.find((b) => distanceInches >= b.start && distanceInches <= b.end);
            if (band) {
                sv += band.mod;
            } else if (distanceInches > params.weaponBands[params.weaponBands.length - 1].end) {
                sv -= 6;
            }
        }
        if (opponentHasCover) {
            sv -= 3;
        }
        sv += params.miscMod;
        return Math.max(1, sv);
    };

    const activeEffectiveSv = computeEffectiveSv(activeParams, distance, reactiveParams.cover);
    const reactiveEffectiveSv = computeEffectiveSv(reactiveParams, distance, activeParams.cover);

    return (
        <div className={styles.diceCalculatorPage}>
            <div className={styles.pageHeader}>
                <div className={styles.modeToggle}>
                    <button
                        className={clsx(styles.modeBtn, mode === 'freeform' && styles.active)}
                        onClick={() => setMode('freeform')}
                    >
                        Freeform
                    </button>
                    <button
                        className={clsx(styles.modeBtn, mode === 'simulator' && styles.active)}
                        onClick={() => setMode('simulator')}
                    >
                        Matchup Simulator
                    </button>
                </div>
            </div>

            {mode === 'simulator' && (
                <div className={styles.globalControls}>
                    <div className={styles.distanceControl}>
                        <label>Engagement Distance</label>
                        <div className={styles.rangePills}>
                            {RANGE_BANDS.map(band => (
                                <button
                                    key={band.label}
                                    className={clsx(styles.rangePill, distance === band.value && styles.active)}
                                    onClick={() => setDistance(band.value)}
                                >
                                    {band.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Input Panels */}
            <div className={styles.inputPanels}>
                {/* Active Panel */}
                <div className={clsx(styles.inputPanel, styles.activePanel)}>
                    <div className={styles.panelHeader}>
                        <Swords size={18} /> <span>Active</span>
                    </div>

                    {mode === 'simulator' && (
                        <>
                            <div className={styles.panelSection}>
                                <CalculatorUnitSelector
                                    onSelect={handleActiveUnitSelect}
                                    placeholder="Search Active Unit..."
                                    onClear={() => handleActiveUnitSelect(undefined)}
                                />
                                {activeUnit && (
                                    <CalculatorProfileSelector
                                        unit={activeUnit}
                                        onSelect={handleActiveProfileSelect}
                                    />
                                )}
                            </div>

                            <div className={styles.panelSection}>
                                <WeaponSelector
                                    onSelect={applyWeaponToActive}
                                    placeholder="Execute Attack With..."
                                    filterOptionIds={activeOption?.weapons.map((w) => w.id)}
                                    disabled={!activeProfile}
                                />
                                {activeParams.selectedWeapon && (
                                    <div className={styles.selectedWeaponIndicator}>
                                        {activeParams.selectedWeapon}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <div className={styles.panelRow}>
                        <div className={styles.svGroup}>
                            <CompactNumber
                                label={mode === 'freeform' ? 'SV' : 'Base SV'}
                                value={activeParams.sv}
                                onChange={v => updateActive('sv', v)}
                                readOnly={mode === 'simulator'}
                            />
                            {mode === 'simulator' && (
                                <div className={styles.effectiveSv}>
                                    Final SV: <strong>{activeEffectiveSv}</strong>
                                </div>
                            )}
                        </div>
                        {mode === 'simulator' && (
                            <CompactNumber label="MOD" value={activeParams.miscMod} onChange={v => updateActive('miscMod', v)} />
                        )}
                        <CompactNumber label="PS" value={activeParams.damage} onChange={v => updateActive('damage', v)} readOnly={mode === 'simulator'} />
                        <CompactNumber label="ARM" value={activeParams.armor} onChange={v => updateActive('armor', v)} readOnly={mode === 'simulator'} />
                    </div>

                    <BurstSelector
                        value={activeParams.burst}
                        onChange={(v: number) => updateActive('burst', v)}
                        readOnly={mode === 'simulator'}
                    />

                    <AmmoSelector
                        ammo={activeParams.ammo}
                        ap={activeParams.ap}
                        continuous={activeParams.continuous}
                        critImmune={activeParams.critImmune}
                        cover={mode === 'simulator' ? activeParams.cover : undefined}
                        onUpdate={updateActive}
                    />
                </div>

                <button className={styles.swapBtn} onClick={swap} title="Swap">
                    <ArrowLeftRight size={18} />
                </button>

                {/* Reactive Panel */}
                <div className={clsx(styles.inputPanel, styles.reactivePanel)}>
                    <div className={styles.panelHeader}>
                        <Shield size={18} /> <span>Reactive</span>
                    </div>

                    {mode === 'simulator' && (
                        <>
                            <div className={styles.panelSection}>
                                <CalculatorUnitSelector
                                    onSelect={handleReactiveUnitSelect}
                                    placeholder="Search Reactive Unit..."
                                    onClear={() => handleReactiveUnitSelect(undefined)}
                                />
                                {reactiveUnit && (
                                    <CalculatorProfileSelector
                                        unit={reactiveUnit}
                                        onSelect={handleReactiveProfileSelect}
                                    />
                                )}
                            </div>

                            <div className={styles.panelSection}>
                                <WeaponSelector
                                    onSelect={applyWeaponToReactive}
                                    placeholder="Execute ARO With..."
                                    filterOptionIds={reactiveOption?.weapons.map((w) => w.id)}
                                    disabled={!reactiveProfile}
                                />
                                {reactiveParams.selectedWeapon && (
                                    <div className={styles.selectedWeaponIndicator}>
                                        {reactiveParams.selectedWeapon}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <div className={styles.panelRow}>
                        <div className={styles.svGroup}>
                            <CompactNumber
                                label={mode === 'freeform' ? 'SV' : 'Base SV'}
                                value={reactiveParams.sv}
                                onChange={v => updateReactive('sv', v)}
                                readOnly={mode === 'simulator'}
                            />
                            {mode === 'simulator' && (
                                <div className={styles.effectiveSv}>
                                    Final SV: <strong>{reactiveEffectiveSv}</strong>
                                </div>
                            )}
                        </div>
                        {mode === 'simulator' && (
                            <CompactNumber label="MOD" value={reactiveParams.miscMod} onChange={v => updateReactive('miscMod', v)} />
                        )}
                        <CompactNumber label="PS" value={reactiveParams.damage} onChange={v => updateReactive('damage', v)} readOnly={mode === 'simulator'} />
                        <CompactNumber label="ARM" value={reactiveParams.armor} onChange={v => updateReactive('armor', v)} readOnly={mode === 'simulator'} />
                    </div>

                    <BurstSelector
                        value={reactiveParams.burst}
                        onChange={(v: number) => updateReactive('burst', v)}
                        isReactive={true}
                        readOnly={mode === 'simulator'}
                    />

                    <AmmoSelector
                        ammo={reactiveParams.ammo}
                        ap={reactiveParams.ap}
                        continuous={reactiveParams.continuous}
                        critImmune={reactiveParams.critImmune}
                        cover={mode === 'simulator' ? reactiveParams.cover : undefined}
                        onUpdate={updateReactive}
                    />
                </div>
            </div>

            {/* Results Section */}
            {results && (
                <div className={styles.resultsSection}>
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
        </div>
    );
}
