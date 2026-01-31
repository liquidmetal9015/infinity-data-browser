import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { Unit } from '../types';
import { listReducer, initialState, type ListState } from '../logic/ListLogic';

// ============================================================================
// Context
// ============================================================================

interface ListContextValue {
    state: ListState;
    createList: (factionId: number, factionName: string, pointsLimit?: number, name?: string) => void;
    addUnit: (unit: Unit, groupIndex: number, profileGroupId: number, profileId: number, optionId: number) => void;
    removeUnit: (groupIndex: number, unitId: string) => void;
    addCombatGroup: () => void;
    removeCombatGroup: (groupIndex: number) => void;
    reorderUnit: (groupIndex: number, fromIndex: number, toIndex: number) => void;
    moveUnitToGroup: (fromGroupIndex: number, toGroupIndex: number, unitId: string, toIndex?: number) => void;
    updateListName: (name: string) => void;
    updatePointsLimit: (pointsLimit: number) => void;
    resetList: () => void;
}

const ListContext = createContext<ListContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function ListProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(listReducer, initialState);

    const createList = useCallback((factionId: number, factionName: string, pointsLimit?: number, name?: string) => {
        dispatch({ type: 'CREATE_LIST', factionId, factionName, pointsLimit, name });
    }, []);

    const addUnit = useCallback((unit: Unit, groupIndex: number, profileGroupId: number, profileId: number, optionId: number) => {
        dispatch({ type: 'ADD_UNIT', unit, groupIndex, profileGroupId, profileId, optionId });
    }, []);

    const removeUnit = useCallback((groupIndex: number, unitId: string) => {
        dispatch({ type: 'REMOVE_UNIT', groupIndex, unitId });
    }, []);

    const addCombatGroup = useCallback(() => {
        dispatch({ type: 'ADD_COMBAT_GROUP' });
    }, []);

    const removeCombatGroup = useCallback((groupIndex: number) => {
        dispatch({ type: 'REMOVE_COMBAT_GROUP', groupIndex });
    }, []);

    const reorderUnit = useCallback((groupIndex: number, fromIndex: number, toIndex: number) => {
        dispatch({ type: 'REORDER_UNIT', groupIndex, fromIndex, toIndex });
    }, []);

    const moveUnitToGroup = useCallback((fromGroupIndex: number, toGroupIndex: number, unitId: string, toIndex?: number) => {
        dispatch({ type: 'MOVE_UNIT_TO_GROUP', fromGroupIndex, toGroupIndex, unitId, toIndex });
    }, []);

    const updateListName = useCallback((name: string) => {
        dispatch({ type: 'UPDATE_LIST_NAME', name });
    }, []);

    const updatePointsLimit = useCallback((pointsLimit: number) => {
        dispatch({ type: 'UPDATE_POINTS_LIMIT', pointsLimit });
    }, []);

    const resetList = useCallback(() => {
        dispatch({ type: 'RESET_LIST' });
    }, []);

    return (
        <ListContext.Provider value={{
            state,
            createList,
            addUnit,
            removeUnit,
            addCombatGroup,
            removeCombatGroup,
            reorderUnit,
            moveUnitToGroup,
            updateListName,
            updatePointsLimit,
            resetList,
        }}>
            {children}
        </ListContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

export function useList(): ListContextValue {
    const context = useContext(ListContext);
    if (!context) {
        throw new Error('useList must be used within a ListProvider');
    }
    return context;
}
