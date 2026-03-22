# Architecture & Design Patterns

## Converged Workspace Engine

Infinity Data Explorer is a single-page React application with a windowed workspace UI. It does **not** use `react-router-dom` — all tools run side-by-side within a draggable, resizable window manager.

### Core Components

| Component | Path | Role |
|-----------|------|------|
| `WorkspaceView` | `src/components/Workspace/WorkspaceView.tsx` | Canvas where windows are rendered |
| `WindowFrame` | `src/components/Workspace/WindowFrame.tsx` | Wraps each widget — title bar, drag, resize, minimize/maximize |
| `widgetRegistry` | `src/components/Workspace/widgetRegistry.tsx` | Maps `WidgetType` → component, icon, label, default size |
| `NavBar` | `src/components/NavBar.tsx` | Tool launcher and tab switcher |
| Workspace types | `src/types/workspace.ts` | `WidgetType`, `WindowState`, `WorkspaceState`, actions |

### Widget Registration

All 9 widgets are registered in `widgetRegistry.tsx`. Each entry maps a `WidgetType` string to a page component from `src/pages/`. The `LAUNCHER_WIDGETS` array controls which widgets appear in the NavBar launcher (Dice Analytics is currently disabled due to performance).

### Layout Modes

- **Multi-Window Mode**: Floating desktop-style windows with drag, resize, and z-index management.
- **Tabbed Mode**: Windows are maximized full-screen; NavBar acts as a tab switcher.
- **Snap**: Windows can be snapped left/right half-screen via `SNAP_WINDOW` action.

### Page → Component Architecture

Each widget has a thin **page** component (`src/pages/*Page.tsx`) that composes the feature-specific **components** (`src/components/*`). Pages handle layout and wiring; components handle UI logic.

```
NavBar → WorkspaceView → WindowFrame → [Page] → [Components]
```

### Key Feature Areas

- **List Builder** (`src/components/ListBuilder/`): Army list construction with combat groups, fireteam assignment, and drag-and-drop reordering via `dnd-kit`.
- **Dice Calculator** (`src/components/DiceCalculator/`): Face-to-face probability calculation with unit/weapon selection.
- **Dice Analytics** (`src/components/DiceAnalytics/`): Statistical charts built with Recharts.
- **Other tools**: Classifieds, Fireteams, Ranges, Compare, Search, Reference — each in their own component directory or as standalone page components.
