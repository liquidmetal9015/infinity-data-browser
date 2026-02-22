// WorkspaceView - Main canvas component that renders active windows + launcher bar
import { useEffect } from 'react';
import { Layout as LayoutIcon } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { WindowFrame } from './WindowFrame';
import { widgetRegistry, LAUNCHER_WIDGETS } from './widgetRegistry';
import type { WidgetType } from '../../types/workspace';
import './WorkspaceView.css';

export function WorkspaceView() {
    const { state, openWindow, focusWindow, restoreWindow } = useWorkspace();

    // Lock page scroll while workspace is active — the canvas manages its own layout
    useEffect(() => {
        const prevBody = document.body.style.overflow;
        const prevHtml = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevBody;
            document.documentElement.style.overflow = prevHtml;
        };
    }, []);

    const visibleWindows = state.windows.filter(w => !w.isMinimized);
    const topZIndex = state.windows.length > 0
        ? Math.max(...state.windows.map(w => w.zIndex))
        : 0;

    return (
        <div className="workspace-view">
            {/* Background canvas */}
            <div className="workspace-canvas" />

            {/* Empty state */}
            {state.windows.length === 0 && (
                <div className="workspace-empty">
                    <LayoutIcon size={48} className="workspace-empty-icon" />
                    <div className="workspace-empty-text">Your workspace is empty</div>
                    <div className="workspace-empty-hint">
                        Use the launcher bar below to open tools
                    </div>
                </div>
            )}

            {/* Windows */}
            <div className="workspace-windows">
                {visibleWindows.map(win => {
                    const entry = widgetRegistry[win.type];
                    if (!entry) return null;

                    const WidgetComponent = entry.component;
                    const IconComponent = entry.icon;
                    const isFocused = win.zIndex === topZIndex;

                    return (
                        <WindowFrame
                            key={win.id}
                            window={win}
                            icon={<IconComponent size={14} />}
                            isFocused={isFocused}
                        >
                            <WidgetComponent {...(win.props || {})} />
                        </WindowFrame>
                    );
                })}
            </div>

            {/* Launcher Bar */}
            <div className="workspace-launcher">
                {/* Tool launch buttons */}
                {LAUNCHER_WIDGETS.map((widgetType: WidgetType) => {
                    const entry = widgetRegistry[widgetType];
                    const IconComponent = entry.icon;
                    return (
                        <button
                            key={widgetType}
                            className="launcher-btn"
                            onClick={() => openWindow(widgetType)}
                            title={`Open ${entry.label}`}
                        >
                            <IconComponent size={14} />
                            <span>{entry.label}</span>
                        </button>
                    );
                })}

                {/* Divider + active/minimized window indicators */}
                {state.windows.length > 0 && (
                    <>
                        <div className="launcher-divider" />
                        {state.windows.map(win => {
                            const entry = widgetRegistry[win.type];
                            if (!entry) return null;
                            const IconComponent = entry.icon;
                            const isMinimized = win.isMinimized;

                            return (
                                <button
                                    key={win.id}
                                    className={`launcher-window-btn ${isMinimized ? 'minimized' : ''}`}
                                    onClick={() => isMinimized ? restoreWindow(win.id) : focusWindow(win.id)}
                                    title={isMinimized ? `Restore ${win.title}` : `Focus ${win.title}`}
                                >
                                    <IconComponent size={12} />
                                    <span>{win.title}</span>
                                </button>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
}
