// WorkspaceContext Reducer Unit Tests
import { describe, it, expect } from 'vitest';
import { workspaceReducer, initialState } from './WorkspaceContext';
import type { WorkspaceState, WorkspaceAction } from '../types/workspace';

describe('workspaceReducer', () => {
    describe('OPEN_WINDOW', () => {
        it('adds a new window with correct defaults', () => {
            const action: WorkspaceAction = { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' };
            const result = workspaceReducer(initialState, action);

            expect(result.windows).toHaveLength(1);
            expect(result.windows[0].type).toBe('DICE_CALCULATOR');
            expect(result.windows[0].title).toBe('Dice Calculator');
            expect(result.windows[0].isMinimized).toBe(false);
            expect(result.windows[0].zIndex).toBe(1);
            expect(result.windows[0].size.width).toBe(550);
            expect(result.windows[0].size.height).toBe(668);
            expect(result.nextZIndex).toBe(2);
        });

        it('assigns cascading positions for multiple windows', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            state = workspaceReducer(state, { type: 'OPEN_WINDOW', widgetType: 'LIST_BUILDER' });

            expect(state.windows).toHaveLength(2);
            // Second window should have an offset position
            expect(state.windows[1].position.x).not.toBe(state.windows[0].position.x);
            expect(state.windows[1].position.y).not.toBe(state.windows[0].position.y);
        });

        it('passes props through to the window', () => {
            const props = { unitSlug: 'fusilier' };
            const action: WorkspaceAction = { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR', props };
            const result = workspaceReducer(initialState, action);

            expect(result.windows[0].props).toEqual(props);
        });

        it('prevents opening multiple windows of the same type, focusing existing instead', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            state = workspaceReducer(state, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });

            expect(state.windows).toHaveLength(1);
        });
    });

    describe('CLOSE_WINDOW', () => {
        it('removes the window by ID', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            const windowId = state.windows[0].id;

            state = workspaceReducer(state, { type: 'CLOSE_WINDOW', windowId });
            expect(state.windows).toHaveLength(0);
        });

        it('does nothing if window ID does not exist', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            const result = workspaceReducer(state, { type: 'CLOSE_WINDOW', windowId: 'nonexistent' });

            expect(result.windows).toHaveLength(1);
        });
    });

    describe('FOCUS_WINDOW', () => {
        it('sets the window to the highest z-index', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            state = workspaceReducer(state, { type: 'OPEN_WINDOW', widgetType: 'LIST_BUILDER' });

            const firstId = state.windows[0].id;
            state = workspaceReducer(state, { type: 'FOCUS_WINDOW', windowId: firstId });

            expect(state.windows.find(w => w.id === firstId)!.zIndex).toBe(state.nextZIndex - 1);
        });

        it('restores minimized windows when focused', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            const windowId = state.windows[0].id;

            state = workspaceReducer(state, { type: 'MINIMIZE_WINDOW', windowId });
            expect(state.windows[0].isMinimized).toBe(true);

            state = workspaceReducer(state, { type: 'FOCUS_WINDOW', windowId });
            expect(state.windows[0].isMinimized).toBe(false);
        });

        it('returns same state if window is already on top', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            const windowId = state.windows[0].id;

            // Window is already the only one (highest z), should return same reference
            const result = workspaceReducer(state, { type: 'FOCUS_WINDOW', windowId });
            expect(result).toBe(state);
        });
    });

    describe('MINIMIZE_WINDOW', () => {
        it('sets isMinimized to true', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            const windowId = state.windows[0].id;

            state = workspaceReducer(state, { type: 'MINIMIZE_WINDOW', windowId });
            expect(state.windows[0].isMinimized).toBe(true);
        });
    });

    describe('RESTORE_WINDOW', () => {
        it('sets isMinimized to false and bumps z-index', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            const windowId = state.windows[0].id;

            state = workspaceReducer(state, { type: 'MINIMIZE_WINDOW', windowId });
            const prevZIndex = state.nextZIndex;

            state = workspaceReducer(state, { type: 'RESTORE_WINDOW', windowId });
            expect(state.windows[0].isMinimized).toBe(false);
            expect(state.windows[0].zIndex).toBe(prevZIndex);
            expect(state.nextZIndex).toBe(prevZIndex + 1);
        });
    });

    describe('MOVE_WINDOW', () => {
        it('updates window position', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            const windowId = state.windows[0].id;

            state = workspaceReducer(state, { type: 'MOVE_WINDOW', windowId, position: { x: 100, y: 200 } });
            expect(state.windows[0].position).toEqual({ x: 100, y: 200 });
        });
    });

    describe('RESIZE_WINDOW', () => {
        it('updates window size', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            const windowId = state.windows[0].id;

            state = workspaceReducer(state, { type: 'RESIZE_WINDOW', windowId, size: { width: 800, height: 600 } });
            expect(state.windows[0].size).toEqual({ width: 800, height: 600 });
        });
    });

    describe('RESTORE_STATE', () => {
        it('replaces the full state', () => {
            const savedState: WorkspaceState = {
                windows: [{
                    id: 'test_1',
                    type: 'LIST_BUILDER',
                    title: 'List Builder',
                    position: { x: 50, y: 50 },
                    size: { width: 700, height: 750 },
                    zIndex: 1,
                    isMinimized: false,
                }],
                nextZIndex: 2,
                layoutMode: 'multi-window',
                maximizedWindowId: null,
            };

            const result = workspaceReducer(initialState, { type: 'RESTORE_STATE', state: savedState });
            expect(result).toEqual(savedState);
        });
    });

    describe('SET_LAYOUT_MODE', () => {
        it('updates layout mode and clears maximized window if switching to multi-window', () => {
            let state = workspaceReducer(initialState, { type: 'SET_LAYOUT_MODE', mode: 'tabbed' });
            expect(state.layoutMode).toBe('tabbed');

            state = { ...state, maximizedWindowId: 'win_1' };
            state = workspaceReducer(state, { type: 'SET_LAYOUT_MODE', mode: 'multi-window' });
            expect(state.layoutMode).toBe('multi-window');
            expect(state.maximizedWindowId).toBeNull();
        });
    });

    describe('TOGGLE_MAXIMIZE', () => {
        it('switches to tabbed mode and maximizes if currently in multi-window', () => {
            let state = workspaceReducer(initialState, { type: 'OPEN_WINDOW', widgetType: 'DICE_CALCULATOR' });
            const windowId = state.windows[0].id;

            state = workspaceReducer(state, { type: 'TOGGLE_MAXIMIZE', windowId });
            expect(state.layoutMode).toBe('tabbed');
            expect(state.maximizedWindowId).toBe(windowId);
            expect(state.windows[0].isMinimized).toBe(false);
        });
    });

    describe('unknown action', () => {
        it('returns unchanged state', () => {
            const state = workspaceReducer(initialState, { type: 'UNKNOWN' } as any);
            expect(state).toBe(initialState);
        });
    });
});
