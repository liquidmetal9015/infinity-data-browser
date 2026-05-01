// FloatingToolOverlay - Renders floating tool windows on non-workspace routes (Explorer mode)
import { useLocation } from 'react-router-dom';
import { useAppModeStore } from '../../stores/useAppModeStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { widgetRegistry, TOOL_WIDGETS } from './widgetRegistry';
import { WindowFrame } from './WindowFrame';

export function FloatingToolOverlay() {
    const { appMode } = useAppModeStore();
    const location = useLocation();
    const { windows } = useWorkspaceStore();

    // Only render on non-workspace routes in Explorer mode
    if (appMode !== 'explorer' || location.pathname === '/') return null;

    const toolWindows = windows.filter(
        w => !w.isMinimized && TOOL_WIDGETS.includes(w.type)
    );

    if (toolWindows.length === 0) return null;

    const topZIndex = Math.max(...toolWindows.map(w => w.zIndex));

    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'auto' }}>
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
