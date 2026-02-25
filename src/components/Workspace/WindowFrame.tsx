// WindowFrame - Draggable, resizable window with title bar controls
import { useRef, useCallback, type ReactNode } from 'react';
import { Minus, X, Maximize, Minimize, PanelLeft, PanelRight } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import type { WindowState } from '../../types/workspace';
import { MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from '../../types/workspace';
import './WindowFrame.css';

interface WindowFrameProps {
    window: WindowState;
    icon?: ReactNode;
    isFocused: boolean;
    children: ReactNode;
}

export function WindowFrame({ window: win, icon, isFocused, children }: WindowFrameProps) {
    const { state, focusWindow, minimizeWindow, closeWindow, moveWindow, resizeWindow, toggleMaximize, snapWindow } = useWorkspace();
    const frameRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const isResizing = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const isTabbed = state.layoutMode === 'tabbed';
    const isMaximized = isTabbed && state.maximizedWindowId === win.id;
    const isHidden = isTabbed && !isMaximized;

    // ── Drag logic ──────────────────────────────────────────────────────
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if (isMaximized) return; // Disable drag in maximized mode

        // Don't drag if clicking on a button
        if ((e.target as HTMLElement).closest('button')) return;

        isDragging.current = true;
        dragOffset.current = {
            x: e.clientX - win.position.x,
            y: e.clientY - win.position.y,
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const newX = Math.max(0, e.clientX - dragOffset.current.x);
            const newY = Math.max(0, e.clientY - dragOffset.current.y);
            moveWindow(win.id, { x: newX, y: newY });
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [win.id, win.position.x, win.position.y, moveWindow]);

    // ── Resize logic ────────────────────────────────────────────────────
    const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
        if (isMaximized) return;
        e.preventDefault();
        e.stopPropagation();
        isResizing.current = true;

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = win.size.width;
        const startHeight = win.size.height;
        const startPosX = win.position.x;
        const startPosY = win.position.y;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;
            let newX = startPosX;
            let newY = startPosY;

            // Horizontal calculations
            if (direction.includes('e')) {
                // Resize from right edge
                newWidth = Math.max(MIN_WINDOW_WIDTH, startWidth + deltaX);
            } else if (direction.includes('w')) {
                // Resize from left edge
                newWidth = Math.max(MIN_WINDOW_WIDTH, startWidth - deltaX);
                // Adjust X position based on how much width ACTUALLY changed
                newX = startPosX + (startWidth - newWidth);
            }

            // Vertical calculations
            if (direction.includes('s')) {
                // Resize from bottom edge
                newHeight = Math.max(MIN_WINDOW_HEIGHT, startHeight + deltaY);
            } else if (direction.includes('n')) {
                // Resize from top edge
                newHeight = Math.max(MIN_WINDOW_HEIGHT, startHeight - deltaY);
                // Adjust Y position based on how much height ACTUALLY changed
                newY = startPosY + (startHeight - newHeight);
            }

            // If we moved the origin, we send size and position. If only bottom/right, size is enough.
            if (direction.includes('n') || direction.includes('w')) {
                resizeWindow(win.id, { width: newWidth, height: newHeight }, { x: newX, y: newY });
            } else {
                resizeWindow(win.id, { width: newWidth, height: newHeight });
            }
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [win.id, win.size.width, win.size.height, win.position.x, win.position.y, isMaximized, resizeWindow]);

    // ── Focus on click ──────────────────────────────────────────────────
    const handleFrameMouseDown = useCallback(() => {
        if (!isFocused) {
            focusWindow(win.id);
        }
    }, [win.id, isFocused, focusWindow]);

    return (
        <div
            ref={frameRef}
            className={`window-frame ${isFocused ? 'focused' : ''} ${win.isMinimized ? 'minimized' : ''} ${isMaximized ? 'maximized' : ''} ${isHidden ? 'hidden-tab' : ''}`}
            style={{
                left: win.position.x,
                top: win.position.y,
                width: win.size.width,
                height: win.size.height,
                zIndex: win.zIndex,
            }}
            onMouseDown={handleFrameMouseDown}
        >
            {/* Title Bar - Only show in Multi-Window mode */}
            {!isMaximized && (
                <div className="window-titlebar" onMouseDown={handleDragStart}>
                    {icon && <div className="window-titlebar-icon">{icon}</div>}
                    <div className="window-title">{win.title}</div>
                    <div className="window-controls">
                        <button
                            className="window-control-btn snap-left"
                            onClick={(e) => { e.stopPropagation(); snapWindow(win.id, 'left'); }}
                            title="Snap Left"
                        >
                            <PanelLeft size={14} />
                        </button>
                        <button
                            className="window-control-btn snap-right"
                            onClick={(e) => { e.stopPropagation(); snapWindow(win.id, 'right'); }}
                            title="Snap Right"
                        >
                            <PanelRight size={14} />
                        </button>
                        <button
                            className="window-control-btn minimize"
                            onClick={(e) => { e.stopPropagation(); minimizeWindow(win.id); }}
                            title="Minimize"
                        >
                            <Minus size={14} />
                        </button>
                        <button
                            className="window-control-btn maximize"
                            onClick={(e) => { e.stopPropagation(); toggleMaximize(win.id); }}
                            title={isMaximized ? "Restore" : "Maximize"}
                        >
                            {isMaximized ? <Minimize size={14} /> : <Maximize size={14} />}
                        </button>
                        <button
                            className="window-control-btn close"
                            onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
                            title="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="window-content">
                {children}
            </div>

            {/* Resize Handles (Edges and Corners) */}
            {!isMaximized && (
                <>
                    {/* Edges */}
                    <div className="window-resize-handle resize-edge-top" onMouseDown={(e) => handleResizeStart(e, 'n')} />
                    <div className="window-resize-handle resize-edge-bottom" onMouseDown={(e) => handleResizeStart(e, 's')} />
                    <div className="window-resize-handle resize-edge-left" onMouseDown={(e) => handleResizeStart(e, 'w')} />
                    <div className="window-resize-handle resize-edge-right" onMouseDown={(e) => handleResizeStart(e, 'e')} />

                    {/* Corners */}
                    <div className="window-resize-handle resize-corner-tl" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
                    <div className="window-resize-handle resize-corner-tr" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
                    <div className="window-resize-handle resize-corner-bl" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
                    <div className="window-resize-handle resize-corner-br" onMouseDown={(e) => handleResizeStart(e, 'se')} />
                </>
            )}
        </div>
    );
}
