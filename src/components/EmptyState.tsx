import type { ReactNode } from 'react';

interface EmptyStateProps {
    icon: ReactNode;
    message: string;
    action?: ReactNode;
    className?: string;
}

/**
 * Reusable empty state display component.
 * Used across pages for consistent "nothing to show" messaging.
 */
export function EmptyState({ icon, message, action, className = '' }: EmptyStateProps) {
    return (
        <div className={`empty-state ${className}`}>
            <div className="empty-state-icon">
                {icon}
            </div>
            <p className="empty-state-message">{message}</p>
            {action && <div className="empty-state-action">{action}</div>}
        </div>
    );
}
