// Zustand store for Dice Calculator state
// Persists calculator parameters between navigation and workspace windows

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RangeBand } from '../../shared/types';

// ============================================================================
// Types
// ============================================================================

export interface DiceCalcParams {
    sv: number;
    burst: number;
    damage: number;
    armor: number;
    ammo: string;
    ap: boolean;
    continuous: boolean;
    bts: number;
    critImmune: boolean;
    cover: boolean;
    miscMod: number;
    weaponBands: RangeBand[];
    selectedWeapon?: string;
    // NOTE: selectedUnit/selectedProfile/selectedOption are NOT persisted
    // because they hold full objects. Users re-select units after refresh.
}

interface DiceCalcStore {
    mode: 'freeform' | 'simulator';
    distance: number;
    activeParams: DiceCalcParams;
    reactiveParams: DiceCalcParams;

    setMode: (mode: 'freeform' | 'simulator') => void;
    setDistance: (distance: number) => void;
    setActiveParams: (params: DiceCalcParams) => void;
    setReactiveParams: (params: DiceCalcParams) => void;
    updateActive: (field: string, val: unknown) => void;
    updateReactive: (field: string, val: unknown) => void;
    swap: () => void;
}

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_PARAMS: DiceCalcParams = {
    sv: 13,
    burst: 3,
    damage: 13,
    armor: 0,
    ammo: 'N',
    ap: false,
    continuous: false,
    bts: 0,
    critImmune: false,
    cover: false,
    miscMod: 0,
    weaponBands: [],
};

// ============================================================================
// Store
// ============================================================================

export const useDiceCalcStore = create<DiceCalcStore>()(
    persist(
        (set, get) => ({
            mode: 'freeform',
            distance: 16,
            activeParams: { ...DEFAULT_PARAMS },
            reactiveParams: { ...DEFAULT_PARAMS, burst: 1 },

            setMode: (mode) => set({ mode }),
            setDistance: (distance) => set({ distance }),
            setActiveParams: (params) => set({ activeParams: params }),
            setReactiveParams: (params) => set({ reactiveParams: params }),

            updateActive: (field, val) => {
                const resetWeapon = ['sv', 'damage', 'armor', 'ammo', 'burst', 'ap', 'continuous', 'weaponBands'].includes(field);
                set(s => ({
                    activeParams: {
                        ...s.activeParams,
                        [field]: val,
                        ...(resetWeapon && { selectedWeapon: undefined }),
                    },
                }));
            },

            updateReactive: (field, val) => {
                const resetWeapon = ['sv', 'damage', 'armor', 'ammo', 'burst', 'ap', 'continuous', 'weaponBands'].includes(field);
                set(s => ({
                    reactiveParams: {
                        ...s.reactiveParams,
                        [field]: val,
                        ...(resetWeapon && { selectedWeapon: undefined }),
                    },
                }));
            },

            swap: () => {
                const { activeParams, reactiveParams } = get();
                set({
                    activeParams: { ...reactiveParams },
                    reactiveParams: { ...activeParams },
                });
            },
        }),
        {
            name: 'infinity-dice-calc-state',
            partialize: (state) => ({
                mode: state.mode,
                distance: state.distance,
                activeParams: state.activeParams,
                reactiveParams: state.reactiveParams,
            }),
        }
    )
);
