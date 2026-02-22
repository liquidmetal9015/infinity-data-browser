// WindowFrame - Draggable, resizable window with title bar controls
import { useRef, useCallback, type ReactNode } from 'react';
import { Minus, X } from 'lucide-react';
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
    const { focusWindow, minimizeWindow, closeWindow, moveWindow, resizeWindow } = useWorkspace();
    const frameRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const isResizing = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // ── Drag logic ──────────────────────────────────────────────────────
    const handleDragStart = useCallback((e: React.MouseEvent) => {
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
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing.current = true;

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = win.size.width;
        const startHeight = win.size.height;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const newWidth = Math.max(MIN_WINDOW_WIDTH, startWidth + (e.clientX - startX));
            const newHeight = Math.max(MIN_WINDOW_HEIGHT, startHeight + (e.clientY - startY));
            resizeWindow(win.id, { width: newWidth, height: newHeight });
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [win.id, win.size.width, win.size.height, resizeWindow]);

    // ── Focus on click ──────────────────────────────────────────────────
    const handleFrameMouseDown = useCallback(() => {
        if (!isFocused) {
            focusWindow(win.id);
        }
    }, [win.id, isFocused, focusWindow]);

    return (
        <div
            ref={frameRef}
            className={`window-frame ${isFocused ? 'focused' : ''} ${win.isMinimized ? 'minimized' : ''}`}
            style={{
                left: win.position.x,
                top: win.position.y,
                width: win.size.width,
                height: win.size.height,
                zIndex: win.zIndex,
            }}
            onMouseDown={handleFrameMouseDown}
        >
            {/* Title Bar */}
            <div className="window-titlebar" onMouseDown={handleDragStart}>
                {icon && <div className="window-titlebar-icon">{icon}</div>}
                <div className="window-title">{win.title}</div>
                <div className="window-controls">
                    <button
                        className="window-control-btn minimize"
                        onClick={(e) => { e.stopPropagation(); minimizeWindow(win.id); }}
                        title="Minimize"
                    >
                        <Minus size={14} />
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

            {/* Content */}
            <div className="window-content">
                {children}
            </div>

            {/* Resize Handle */}
            <div className="window-resize-handle" onMouseDown={handleResizeStart} />
        </div>
    );
}
