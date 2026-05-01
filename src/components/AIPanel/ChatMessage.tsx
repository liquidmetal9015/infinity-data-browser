import styles from './AIPanel.module.css';
import type { ChatMessage as ChatMessageType } from '../../stores/useAIPanelStore';

interface Props {
    message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
    const isUser = message.role === 'user';
    return (
        <div className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAssistant}`}>
            <div className={styles.messageBubble}>
                <p className={styles.messageText}>{message.content}</p>
                {message.toolsUsed && message.toolsUsed.length > 0 && (
                    <div className={styles.toolsUsed}>
                        {message.toolsUsed.map(t => (
                            <span key={t} className={styles.toolChip}>{t}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
