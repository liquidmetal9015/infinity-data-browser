// FloatingToolOverlay - Renders floating tool windows on non-workspace routes (Explorer mode)
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppModeStore } from '../../stores/useAppModeStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { widgetRegistry, TOOL_WIDGETS } from './widgetRegistry';
import { WindowFrame } from './WindowFrame';

export function FloatingToolOverlay() {
    const { appMode } = useAppModeStore();
    const location = useLocation();
    const { windows, layoutMode, setLayoutMode } = useWorkspaceStore();

    // Tabbed/maximized mode is list-builder-only. If the user somehow arrives in
    // explorer mode with tabbed state persisted (e.g. from localStorage), reset it
    // so tool windows never render as full-screen overlays covering the nav bar.
    useEffect(() => {
        if (appMode === 'explorer' && layoutMode === 'tabbed') {
            setLayoutMode('multi-window');
        }
    }, [appMode, layoutMode, setLayoutMode]);

    // Only render on non-workspace routes in Explorer mode
    if (appMode !== 'explorer' || location.pathname === '/') return null;

    const toolWindows = windows.filter(
        w => !w.isMinimized && TOOL_WIDGETS.includes(w.type)
    );

    if (toolWindows.length === 0) return null;

    const topZIndex = Math.max(...toolWindows.map(w => w.zIndex));

    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
                {toolWindows.map(win => {
                    const entry = widgetRegistry[win.type];
                    if (!entry) return null;
                    const WidgetComponent = entry.component;
                    const IconComponent = entry.icon;
                    const isFocused = win.zIndex === topZIndex;
                    return (
                        <WindowFrame key={win.id} window={win} icon={<IconComponent size={14} />} isFocused={isFocused}>
                            <WidgetComponent {...(win.props || {})} />
                        </WindowFrame>
                    );
                })}
            </div>
        </div>
    );
}
