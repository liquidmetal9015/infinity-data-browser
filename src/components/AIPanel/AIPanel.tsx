import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import type { ArmyList } from '@shared/listTypes';
import { calculateListPoints, calculateListSWC } from '@shared/listTypes';
import { useAIPanelStore, type ChatContext } from '../../stores/useAIPanelStore';
import { useDatabase } from '../../hooks/useDatabase';
import { STATIC_MODE } from '../../services/listService';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import styles from './AIPanel.module.css';

const SUGGESTED_PROMPTS = [
    'Suggest a fireteam for this list',
    'What classifieds can I complete?',
    'Find me a gunfighter under 50pts',
    'Analyze my list\'s weaknesses',
];

interface Props {
    list: ArmyList;
}

function buildContext(list: ArmyList, factionName: string): ChatContext {
    return {
        faction_id: list.factionId,
        faction_name: factionName || undefined,
        list_points: calculateListPoints(list),
        list_swc: calculateListSWC(list),
        list_units: list.groups.flatMap(g =>
            g.units.map(lu => ({
                name: lu.unit.name,
                isc: lu.unit.isc,
                loadout: '',
                points: 0,
                swc: 0,
            }))
        ),
    };
}

export function AIPanel({ list }: Props) {
    const db = useDatabase();
    const { messages, isLoading, error, togglePanel, sendMessage, clearHistory } =
        useAIPanelStore();
    const bottomRef = useRef<HTMLDivElement>(null);
    const factionName = db ? db.getFactionName(list.factionId) : '';

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (message: string) => {
        sendMessage(message, buildContext(list, factionName));
    };

    return (
        <motion.div
            className={styles.panel}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className={styles.header}>
                <span className={styles.headerTitle}>AI Assistant</span>
                <div className={styles.headerActions}>
                    {messages.length > 0 && (
                        <button
                            className={styles.iconBtn}
                            onClick={clearHistory}
                            title="Clear conversation"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                    <button className={styles.iconBtn} onClick={togglePanel} title="Close">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {STATIC_MODE && (
                <div className={styles.staticNotice}>
                    AI assistant is not available in offline mode.
                </div>
            )}

            <div className={styles.messages}>
                {messages.length === 0 && !STATIC_MODE && (
                    <div className={styles.emptyState}>
                        <p className={styles.emptyHint}>Ask anything about your list or the game:</p>
                        <div className={styles.suggestionChips}>
                            {SUGGESTED_PROMPTS.map(p => (
                                <button
                                    key={p}
                                    className={styles.chip}
                                    onClick={() => handleSend(p)}
                                    disabled={isLoading}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map(m => (
                    <ChatMessage key={m.id} message={m} />
                ))}

                {isLoading && (
                    <div className={styles.thinking}>
                        <span className={styles.dot} />
                        <span className={styles.dot} />
                        <span className={styles.dot} />
                    </div>
                )}

                {error && <div className={styles.errorBanner}>{error}</div>}

                <div ref={bottomRef} />
            </div>

            <ChatInput onSend={handleSend} disabled={isLoading || STATIC_MODE} />
        </motion.div>
    );
}
