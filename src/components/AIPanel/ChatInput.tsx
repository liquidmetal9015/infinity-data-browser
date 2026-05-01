import { useRef, type KeyboardEvent } from 'react';
import styles from './AIPanel.module.css';

interface Props {
    onSend: (message: string) => void;
    disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
    const ref = useRef<HTMLTextAreaElement>(null);

    const handleSend = () => {
        const val = ref.current?.value.trim();
        if (!val || disabled) return;
        onSend(val);
        if (ref.current) ref.current.value = '';
    };

    const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={styles.inputBar}>
            <textarea
                ref={ref}
                className={styles.inputField}
                placeholder="Ask about units, fireteams, tactics…"
                rows={2}
                disabled={disabled}
                onKeyDown={handleKey}
            />
            <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={disabled}
                aria-label="Send"
            >
                ↑
            </button>
        </div>
    );
}
