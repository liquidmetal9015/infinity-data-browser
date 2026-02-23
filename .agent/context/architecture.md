# Architecture & Design Patterns

## Converged Workspace Engine
Infinity Data Explorer is a single-page React application that acts as a unified workspace. It does **not** use `react-router-dom` to navigate between different tools (like Builder, Calculator, etc.). Instead, all tools run side-by-side within a draggable, resizable window manager.

The workspace configuration is defined in `/src/types/workspace.ts` and managed by the `WorkspaceContext` (`/src/context/WorkspaceContext.tsx`).

### Core Concepts
1. **Tool Singletons**: Tools (like the List Builder or Dice Calculator) are singletons. You can only open one instance of each tool at a time.
2. **Top Navigation (`NavBar.tsx`)**: The primary navigation serves as a tool launcher and tab switcher. It includes a layout toggle.
3. **Workspace Canvas (`WorkspaceView.tsx`)**: The main area where windows are rendered.
4. **Draggable Windows (`WindowFrame.tsx`)**: Wraps component views, providing a title bar, drag-and-drop, resizing, and minimize/maximize functionality.

### Layout Modes
The workspace supports two reactive modes:
- **Multi-Window Mode**: Classic desktop-style floating windows.
- **Tabbed / Maximized Mode**: Windows are maximized, hiding the title bar and taking the full screen. The NavBar functions as a tab switcher.

## Legacy Dead Code to Avoid
- `react-router-dom` is **NOT** used for page routing. `HashRouter` is completely removed from application pathways for launching tools.
- Bottom launchers have been removed in favor of the Top NavBar.
