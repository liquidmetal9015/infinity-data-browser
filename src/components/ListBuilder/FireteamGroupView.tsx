import { motion } from 'framer-motion';
import { Users, X } from 'lucide-react';
import React from 'react';
import styles from './FireteamGroupView.module.css';

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
            className={styles.fireteamContainer}
            style={{
                '--ft-color': color,
                '--ft-bg': `${color}15`,
                '--ft-border': `${color}40`,
            } as React.CSSProperties}
        >
            <div className={styles.fireteamHeader}>
                <div className={styles.fireteamTitle}>
                    <Users size={16} />
                    <span>Fireteam {notes ? `- ${notes}` : ''}</span>
                </div>
                <button
                    className={styles.clearFireteamBtn}
                    onClick={onDisband}
                    title="Disband Fireteam"
                >
                    <X size={14} />
                </button>
            </div>
            <div className={styles.fireteamMembers}>
                {children}
            </div>
        </motion.div>
    );
}
