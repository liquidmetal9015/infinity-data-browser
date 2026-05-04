import { clsx } from 'clsx';
import styles from './TagBadge.module.css';

interface TagBadgeProps {
    tag: string;
    onRemove?: () => void;
}

export function TagBadge({ tag, onRemove }: TagBadgeProps) {
    const className = clsx(styles.badge, onRemove && styles.removable);
    if (onRemove) {
        return (
            <span className={className} onClick={onRemove} title="Click to remove" role="button">
                #{tag}
            </span>
        );
    }
    return <span className={className}>#{tag}</span>;
}
