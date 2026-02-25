import { motion } from 'framer-motion';
import { Users, X } from 'lucide-react';
import React from 'react';

interface FireteamGroupViewProps {
    color: string;
    notes?: string;
    onDisband: () => void;
    children: React.ReactNode;
}

export function FireteamGroupView({
    color,
    notes,
    onDisband,
    children
}: FireteamGroupViewProps) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fireteam-container"
            style={{
                '--ft-color': color,
                '--ft-bg': `${color}15`,
                '--ft-border': `${color}40`,
            } as React.CSSProperties}
        >
            <div className="fireteam-header">
                <div className="fireteam-title">
                    <Users size={16} />
                    <span>Fireteam {notes ? `- ${notes}` : ''}</span>
                </div>
                <button
                    className="clear-fireteam-btn"
                    onClick={onDisband}
                    title="Disband Fireteam"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="fireteam-members">
                {children}
            </div>

            <style>{`
                .fireteam-container {
                    margin: 0.25rem 0;
                    border-radius: 6px;
                    border: 1px solid var(--ft-border);
                    border-left: 4px solid var(--ft-color);
                    background: var(--ft-bg);
                    overflow: hidden;
                }
                .fireteam-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.4rem 0.75rem;
                    background: rgba(0,0,0,0.1);
                    color: var(--text-primary);
                    font-size: 0.85rem;
                    font-weight: 600;
                    border-bottom: 1px solid var(--ft-border);
                }
                html[data-theme='light'] .fireteam-header {
                    background: rgba(255,255,255,0.4);
                }
                .fireteam-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }
                html[data-theme='light'] .fireteam-title {
                    text-shadow: none;
                }
                .clear-fireteam-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.2rem;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .clear-fireteam-btn:hover {
                    color: var(--color-error);
                    background: rgba(var(--color-error-rgb), 0.1);
                }
                .fireteam-members {
                    padding: 0.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
            `}</style>
        </motion.div>
    );
}
