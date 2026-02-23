# State Management

## Zustand Global Singleton Stores
Infinity Data Explorer uses **Zustand** for almost all state management. This replaced React Context for several reasons:
- **Persistence**: State is persisted across page reloads using Zustand's `persist` middleware with `localStorage`.
- **Global Sharing**: Zustand stores exist outside the React tree, avoiding infinite render loops and allowing hooks to be used anywhere without needing a Context Provider wrapper.
- **Alignment with Singleton Windows**: Because tools (like the List Builder) are singletons in the workspace, their state can safely be global.

### Key Stores
- `useListStore` (`/src/stores/useListStore.ts`): Manages the state of the active Army List being built.
- `useDiceCalcStore` (`/src/stores/useDiceCalcStore.ts`): Manages the Dice Calculator form inputs (Freeform vs Simulator mode), selected profiles, weapons, and distances.
- `useCompareStore` (`/src/stores/useCompareStore.ts`): Manages the factions selected for the Faction Comparison tool.
- `useRangesStore` (`/src/stores/useRangesStore.ts`): Keeps track of selected weapons for the Weapon Ranges graph.
- `useClassifiedsStore` (`/src/stores/useClassifiedsStore.ts`): Persists faction selection for the Classifieds tool.

## Workspace State
While feature-specific state relies on Zustand, the physical window manager relies on `useReducer` and React Context (`WorkspaceContext.tsx`) for managing layout, window positions, Z-index ordering, and sizes.
