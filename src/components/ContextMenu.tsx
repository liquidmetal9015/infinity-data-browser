import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useContextMenuStore as useContextMenu } from '../stores/useContextMenuStore';

export const ContextMenu: React.FC = () => {
    const { isOpen, position, items, hideMenu } = useContextMenu();
    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    // Close menu on click outside or escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleClickInteraction = (e: MouseEvent) => {
            // If clicking inside the menu, let the individual items handle their own close logic
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                hideMenu();
            }
        };

        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                hideMenu();
            }
        };

        const handleContextMenu = (e: MouseEvent) => {
            // If we're right clicking somewhere else, close this menu so a new one can open
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                hideMenu();
            }
        }

        // Capture true to catch it before other elements can stop it
        window.addEventListener('mousedown', handleClickInteraction, { capture: true });
        window.addEventListener('keydown', handleKeydown, { capture: true });
        window.addEventListener('contextmenu', handleContextMenu, { capture: true });

        return () => {
            window.removeEventListener('mousedown', handleClickInteraction, { capture: true });
            window.removeEventListener('keydown', handleKeydown, { capture: true });
            window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
        };
    }, [isOpen, hideMenu]);

    // Adjust position to stay within viewport
    useEffect(() => {
        if (isOpen && menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            let newX = position.x;
            let newY = position.y;

            const buffer = 8; // Pixels from edge

            if (newX + rect.width > window.innerWidth - buffer) {
                newX = window.innerWidth - rect.width - buffer;
            }
            if (newY + rect.height > window.innerHeight - buffer) {
                newY = window.innerHeight - rect.height - buffer;
            }

            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAdjustedPosition({ x: newX, y: newY });
        } else {
            setAdjustedPosition(position);
        }
    }, [isOpen, position]);

    if (!isOpen) return null;

    const menuContent = (
        <div
            ref={menuRef}
            className="fixed z-[9999] bg-slate-900 border border-slate-700/50 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] py-2 min-w-[260px] text-lg overflow-hidden backdrop-blur-md backdrop-filter bg-opacity-95 text-slate-200"
            style={{
                left: `${adjustedPosition.x}px`,
                top: `${adjustedPosition.y}px`,
            }}
            // Prevent clicks inside the menu from unnecessarily bubbling up and triggering other things
            onClick={(e) => e.stopPropagation()}
        >
            {items.map((item, index) => {
                if (item.divider) {
                    return <div key={`divider-${index}`} className="h-[1px] bg-slate-700/50 my-1.5" />;
                }

                return (
                    <button
                        key={index}
                        className={`w-full text-left px-5 py-3 hover:bg-slate-800 transition-colors flex items-center gap-3 group font-medium
              ${item.destructive ? 'hover:bg-red-500/10 hover:text-red-400' : ''}
            `}
                        onClick={() => {
                            item.action();
                            hideMenu();
                        }}
                    >
                        {item.icon && (
                            <span className={`opacity-70 group-hover:opacity-100 ${item.destructive ? 'text-red-400' : ''}`}>
                                {item.icon}
                            </span>
                        )}
                        {item.label}
                    </button>
                );
            })}
        </div>
    );

    return ReactDOM.createPortal(menuContent, document.body);
};
