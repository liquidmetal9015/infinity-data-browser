// WorkspaceView - Main canvas component that renders active windows + launcher bar
import { useRef, useCallback, Fragment } from 'react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useContextMenuStore as useContextMenu } from '../../stores/useContextMenuStore';
import { WindowFrame } from './WindowFrame';
import { widgetRegistry } from './widgetRegistry';
import { getColumnPanels } from '../../types/workspace';
import type { WidgetType } from '../../types/workspace';
import { clsx } from 'clsx';
import { useIsMobile } from '../../hooks/useIsMobile';
import styles from './WorkspaceView.module.css';

interface DragDividerProps {
    index: number;
    columnWidths: number[];
    setColumnWidths: (widths: number[]) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

function DragDivider({ index, columnWidths, setColumnWidths, containerRef }: DragDividerProps) {
    const dragState = useRef<{ startX: number; startWidths: number[] } | null>(null);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragState.current = { startX: e.clientX, startWidths: [...columnWidths] };
    }, [columnWidths]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragState.current || !containerRef.current) return;
        const { startX, startWidths } = dragState.current;
        const containerWidth = containerRef.current.offsetWidth;
        const total = startWidths.reduce((a, b) => a + b, 0);
        const deltaFraction = ((e.clientX - startX) / containerWidth) * total;
        const minW = total * 0.1;

        const newWidths = [...startWidths];
        newWidths[index] = Math.max(minW, startWidths[index] + deltaFraction);
        newWidths[index + 1] = Math.max(minW, startWidths[index + 1] - deltaFraction);
        setColumnWidths(newWidths);
    }, [index, containerRef, setColumnWidths]);

    const onPointerUp = useCallback(() => {
        dragState.current = null;
    }, []);

    return (
        <div
            className={styles.columnDivider}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        />
    );
}

export function WorkspaceView() {
    const {
        windows, layoutMode, columnWidths, columnCount, activeColumnIndex,
        closeWindow, setColumnWidths, setActiveColumn,
    } = useWorkspaceStore();
    const { showMenu } = useContextMenu();
    const columnsRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();
    const touchStartX = useRef(0);

    const visibleWindows = windows.filter(w => !w.isMinimized);
    const topZIndex = windows.length > 0 ? Math.max(...windows.map(w => w.zIndex)) : 0;
    const activeColumns = getColumnPanels(columnCount);

    const contextMenuItems = [
        { label: 'Force Reload App', action: () => window.location.reload(), icon: <span className="text-lg">↻</span> },
        { divider: true, action: () => { } },
        { label: 'Close All Windows', action: () => windows.forEach(w => closeWindow(w.id)), destructive: true },
    ];

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const delta = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(delta) < 50) return;
        if (delta > 0) {
            setActiveColumn(Math.min(activeColumnIndex + 1, activeColumns.length - 1));
        } else {
            setActiveColumn(Math.max(activeColumnIndex - 1, 0));
        }
    }, [activeColumnIndex, activeColumns.length, setActiveColumn]);

    // ── Columns mode ────────────────────────────────────────────────────────
    if (layoutMode === 'columns') {
        const columnTypes = new Set<WidgetType>(activeColumns);
        const floatingWindows = visibleWindows.filter(w => !columnTypes.has(w.type));
        const trackStyle = isMobile
            ? { transform: `translateX(-${activeColumnIndex * 100}vw)` }
            : undefined;

        return (
            <div
                className={styles.workspaceView}
                onContextMenu={(e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, contextMenuItems); }}
            >
                <div className={styles.workspaceColumns} ref={columnsRef}>
                    <div
                        className={styles.workspaceColumnsTrack}
                        style={trackStyle}
                        onTouchStart={isMobile ? handleTouchStart : undefined}
                        onTouchEnd={isMobile ? handleTouchEnd : undefined}
                    >
                        {activeColumns.map((type, i) => {
                            const entry = widgetRegistry[type];
                            const WidgetComponent = entry.component;
                            const IconComponent = entry.icon;
                            return (
                                <Fragment key={type}>
                                    {i > 0 && !isMobile && (
                                        <DragDivider
                                            index={i - 1}
                                            columnWidths={columnWidths}
                                            setColumnWidths={setColumnWidths}
                                            containerRef={columnsRef}
                                        />
                                    )}
                                    <div
                                        className={styles.workspaceColumn}
                                        style={isMobile ? undefined : { flex: columnWidths[i] ?? 1 }}
                                    >
                                        <div className={styles.columnHeader}>
                                            <IconComponent size={13} />
                                            <span>{entry.label}</span>
                                        </div>
                                        <div className={styles.columnContent}>
                                            <WidgetComponent />
                                        </div>
                                    </div>
                                </Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Mobile column position dots */}
                {isMobile && activeColumns.length > 1 && (
                    <div className={styles.mobileColumnDots}>
                        {activeColumns.map((_, i) => (
                            <button
                                key={i}
                                className={clsx(styles.dot, i === activeColumnIndex && styles.dotActive)}
                                onClick={() => setActiveColumn(i)}
                            />
                        ))}
                    </div>
                )}

                {/* Floating non-column windows sit on top */}
                {floatingWindows.length > 0 && (
                    <div className={styles.workspaceWindows}>
                        {floatingWindows.map(win => {
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
                )}
            </div>
        );
    }

    // ── Multi-window / Tabbed mode ──────────────────────────────────────────
    return (
        <div
            className={styles.workspaceView}
            onContextMenu={(e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, contextMenuItems); }}
        >
            <div className={styles.workspaceCanvas} />

            {windows.length === 0 && (
                <div className={styles.workspaceEmpty}>
                    <div className={styles.workspaceEmptyText}>No windows open</div>
                    <div className={styles.workspaceEmptyHint}>
                        Use the panel buttons above to open tools, or switch to Columns mode
                    </div>
                </div>
            )}

            <div className={styles.workspaceWindows}>
                {visibleWindows.map(win => {
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
