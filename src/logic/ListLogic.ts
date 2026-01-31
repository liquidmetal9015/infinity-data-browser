// Re-export list logic from shared module
// Maintains backwards compatibility for existing imports

export type {
    ListState,
    ListAction,
} from '../../shared/listLogic';

export {
    initialState,
    listReducer,
} from '../../shared/listLogic';
