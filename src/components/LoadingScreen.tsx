import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
    return (
        <div className="loading-screen" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)'
        }}>
            <Loader2 className="loading-spinner" size={48} style={{ animation: 'spin 1s linear infinite' }} />
            <div className="loading-text" style={{ marginTop: '1rem', fontSize: 'var(--text-xl)', fontWeight: 'var(--font-semibold)' }}>
                Initializing Database...
            </div>
            <div className="loading-subtext" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                Loading unit data
            </div>
        </div>
    );
};
