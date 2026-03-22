// WorkspaceView - Main canvas component that renders active windows + launcher bar
import { useEffect } from 'react';
import { Layout as LayoutIcon } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useContextMenuStore as useContextMenu } from '../../stores/useContextMenuStore';
import { WindowFrame } from './WindowFrame';
import { widgetRegistry } from './widgetRegistry';
import './WorkspaceView.css';

export function WorkspaceView() {
    const { windows, closeWindow } = useWorkspaceStore();
    const { showMenu } = useContextMenu();

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

    const visibleWindows = windows.filter(w => !w.isMinimized);
    const topZIndex = windows.length > 0
        ? Math.max(...windows.map(w => w.zIndex))
        : 0;

    return (
        <div className="workspace-view">
            {/* Background canvas */}
            <div
                className="workspace-canvas"
                onContextMenu={(e) => {
                    e.preventDefault();
                    showMenu(e.clientX, e.clientY, [
                        { label: 'Force Reload App', action: () => window.location.reload(), icon: <span className="text-lg">↻</span> },
                        { divider: true, action: () => { } },
                        { label: 'Close All Windows', action: () => windows.forEach(w => closeWindow(w.id)), destructive: true },
                    ]);
                }}
            />

            {/* Empty state */}
            {windows.length === 0 && (
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
        </div>
    );
}
