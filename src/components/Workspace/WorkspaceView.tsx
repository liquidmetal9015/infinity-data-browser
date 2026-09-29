// WorkspaceView - Main canvas component that renders active windows + launcher bar
import { useRef, useCallback, Fragment } from 'react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useContextMenuStore as useContextMenu } from '../../stores/useContextMenuStore';
import { useListStore } from '../../stores/useListStore';
import { WindowFrame } from './WindowFrame';
import { widgetRegistry, PANEL_WIDGETS, TOOL_WIDGETS } from './widgetRegistry';
import { NoActiveListView } from './NoActiveListView';
import { getColumnPanels } from '../../types/workspace';
import type { WidgetType } from '../../types/workspace';
import { clsx } from 'clsx';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Columns3, AppWindow, Maximize } from 'lucide-react';
import styles from './WorkspaceView.module.css';

interface DragDividerProps {
    index: number;
    columnWidths: number[];
    setColumnWidths: (widths: number[]) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
    trackRef: React.RefObject<HTMLDivElement | null>;
}

function DragDivider({ index, columnWidths, setColumnWidths, containerRef, trackRef }: DragDividerProps) {
    // During a drag we write column widths directly to CSS variables on the
    // track (bypassing React/zustand) and only commit to the store on pointer
    // up. This skips ~60 reconciliations per second of all panel content while
    // the user is dragging.
    const dragState = useRef<{ startX: number; startWidths: number[]; latest: number[] } | null>(null);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragState.current = {
            startX: e.clientX,
            startWidths: [...columnWidths],
            latest: [...columnWidths],
        };
    }, [columnWidths]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragState.current || !containerRef.current || !trackRef.current) return;
        const { startX, startWidths } = dragState.current;
        const containerWidth = containerRef.current.offsetWidth;
        const total = startWidths.reduce((a, b) => a + b, 0);
        const deltaFraction = ((e.clientX - startX) / containerWidth) * total;
        const minW = total * 0.1;

        const newWidths = [...startWidths];
        newWidths[index] = Math.max(minW, startWidths[index] + deltaFraction);
        newWidths[index + 1] = Math.max(minW, startWidths[index + 1] - deltaFraction);
        dragState.current.latest = newWidths;

        // Imperative update — no React render this tick.
        const track = trackRef.current;
        for (let i = 0; i < newWidths.length; i++) {
            track.style.setProperty(`--col-w-${i}`, String(newWidths[i]));
        }
    }, [index, containerRef, trackRef]);

    const onPointerUp = useCallback(() => {
        if (dragState.current) {
            // Commit final widths to the store exactly once. The store's
            // localStorage write is debounced (200ms trailing).
            setColumnWidths(dragState.current.latest);
        }
        dragState.current = null;
    }, [setColumnWidths]);

    return (
        <div
            className={styles.columnDivider}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        />
    );
}

export function WorkspaceView() {
    const {
        windows, layoutMode, columnWidths, columnCount, activeColumnIndex,
        closeWindow, setColumnWidths, setActiveColumn, setLayoutMode, setColumnCount, openWindow,
    } = useWorkspaceStore();
    const { showMenu } = useContextMenu();
    const currentList = useListStore(s => s.currentList);
    const columnsRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();
    const touchStartX = useRef(0);

    const visibleWindows = windows.filter(w => !w.isMinimized);
    const topZIndex = windows.length > 0 ? Math.max(...windows.map(w => w.zIndex)) : 0;

    const renderToolbar = () => (
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-slate-900/90 border-b border-white/10 backdrop-blur z-30 shrink-0 overflow-x-auto text-xs">
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-1">Panels:</span>
                {PANEL_WIDGETS.map(type => {
                    const entry = widgetRegistry[type];
                    const Icon = entry.icon;
                    const isOpen = windows.some(w => w.type === type && !w.isMinimized);
                    return (
                        <button
                            key={type}
                            type="button"
                            onClick={() => openWindow(type)}
                            className={clsx(
                                "flex items-center gap-1.5 px-2 py-1 rounded font-medium transition-colors cursor-pointer whitespace-nowrap",
                                isOpen ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-gray-400 hover:text-gray-200 border border-white/5"
                            )}
                        >
                            <Icon size={12} />
                            <span>{entry.label}</span>
                        </button>
                    );
                })}
                <div className="w-[1px] h-3.5 bg-white/10 mx-1" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-1">Tools:</span>
                {TOOL_WIDGETS.map(type => {
                    const entry = widgetRegistry[type];
                    const Icon = entry.icon;
                    const isOpen = windows.some(w => w.type === type && !w.isMinimized);
                    return (
                        <button
                            key={type}
                            type="button"
                            onClick={() => openWindow(type)}
                            className={clsx(
                                "flex items-center gap-1.5 px-2 py-1 rounded font-medium transition-colors cursor-pointer whitespace-nowrap",
                                isOpen ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-white/5 text-gray-400 hover:text-gray-200 border border-white/5"
                            )}
                        >
                            <Icon size={12} />
                            <span>{entry.label}</span>
                        </button>
                    );
                })}
            </div>

            {!isMobile && (
                <div className="flex items-center gap-2">
                    {layoutMode === 'columns' && (
                        <div className="flex items-center p-0.5 bg-black/40 rounded border border-white/10">
                            <button
                                type="button"
                                onClick={() => setColumnCount(2)}
                                className={clsx("px-2 py-0.5 rounded text-xs font-medium cursor-pointer", columnCount === 2 ? "bg-blue-500/30 text-blue-300" : "text-gray-400 hover:text-gray-200")}
                            >
                                2-col
                            </button>
                            <button
                                type="button"
                                onClick={() => setColumnCount(3)}
                                className={clsx("px-2 py-0.5 rounded text-xs font-medium cursor-pointer", columnCount === 3 ? "bg-blue-500/30 text-blue-300" : "text-gray-400 hover:text-gray-200")}
                            >
                                3-col
                            </button>
                        </div>
                    )}
                    <div className="flex items-center p-0.5 bg-black/40 rounded border border-white/10">
                        <button
                            type="button"
                            onClick={() => setLayoutMode('columns')}
                            className={clsx("flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer", layoutMode === 'columns' ? "bg-blue-500/30 text-blue-300" : "text-gray-400 hover:text-gray-200")}
                            title="Columns Layout"
                        >
                            <Columns3 size={12} />
                            <span>Columns</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setLayoutMode('multi-window')}
                            className={clsx("flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer", layoutMode === 'multi-window' ? "bg-blue-500/30 text-blue-300" : "text-gray-400 hover:text-gray-200")}
                            title="Multi-Window Layout"
                        >
                            <AppWindow size={12} />
                            <span>Windows</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setLayoutMode('tabbed')}
                            className={clsx("flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer", layoutMode === 'tabbed' ? "bg-blue-500/30 text-blue-300" : "text-gray-400 hover:text-gray-200")}
                            title="Maximized (Tabbed) Layout"
                        >
                            <Maximize size={12} />
                            <span>Maximized</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    // On mobile, always render the columns carousel with the 2-column layout —
    // multi-window/tabbed assume a desktop canvas, and the 3-column variant
    // adds Unit Detail which is more usefully reached on demand on a phone.
    // We override the render branch only; persisted layoutMode/columnCount are
    // preserved for desktop.
    const effectiveLayoutMode = isMobile ? 'columns' : layoutMode;
    const effectiveColumnCount = isMobile ? 2 : columnCount;
    const activeColumns = getColumnPanels(effectiveColumnCount);

    const LIST_BUILDER_TYPES: WidgetType[] = ['UNIT_ROSTER', 'ARMY_LIST'];
    const isInListBuilder =
        effectiveLayoutMode === 'columns'
            ? activeColumns.some(t => LIST_BUILDER_TYPES.includes(t))
            : windows.some(w => LIST_BUILDER_TYPES.includes(w.type));

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

    if (isInListBuilder && !currentList) {
        return (
            <div
                className={clsx(styles.workspaceView, "flex flex-col h-full w-full")}
                onContextMenu={(e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, contextMenuItems); }}
            >
                {renderToolbar()}
                <div className="flex-1 min-h-0 relative">
                    <NoActiveListView />
                </div>
            </div>
        );
    }

    // ── Columns mode ────────────────────────────────────────────────────────
    if (effectiveLayoutMode === 'columns') {
        const columnTypes = new Set<WidgetType>(activeColumns);
        // On mobile we never want floating windows on top of the carousel —
        // they assume a draggable desktop canvas and can leave users trapped.
        const floatingWindows = isMobile
            ? []
            : visibleWindows.filter(w => !columnTypes.has(w.type));
        // On desktop, expose each column width as a CSS variable on the track.
        // Columns read these via `flex: var(--col-w-N)`. The DragDivider
        // mutates them imperatively during a drag, so React only re-renders on
        // drag-end.
        const trackStyle: React.CSSProperties = isMobile
            ? { transform: `translateX(-${activeColumnIndex * 100}vw)` }
            : Object.fromEntries(
                columnWidths.map((w, i) => [`--col-w-${i}`, w]),
            ) as React.CSSProperties;

        return (
            <div
                className={clsx(styles.workspaceView, "flex flex-col h-full w-full")}
                onContextMenu={(e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, contextMenuItems); }}
            >
                {renderToolbar()}
                <div className="flex-1 min-h-0 relative overflow-hidden">
                    <div className={styles.workspaceColumns} ref={columnsRef}>
                        <div
                            className={styles.workspaceColumnsTrack}
                            ref={trackRef}
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
                                                trackRef={trackRef}
                                            />
                                        )}
                                        <div
                                            className={styles.workspaceColumn}
                                            style={isMobile ? undefined : { flex: `var(--col-w-${i})` }}
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
            </div>
        );
    }

    // ── Multi-window / Tabbed mode ──────────────────────────────────────────
    return (
        <div
            className={clsx(styles.workspaceView, "flex flex-col h-full w-full")}
            onContextMenu={(e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, contextMenuItems); }}
        >
            {renderToolbar()}
            <div className="flex-1 min-h-0 relative overflow-hidden">
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
        </div>
    );
}
