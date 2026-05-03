import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompactFactionSelector } from '../shared/CompactFactionSelector';
import type { useDatabase } from '../../hooks/useDatabase';

interface NewListModalProps {
    db: ReturnType<typeof useDatabase>;
    globalFactionId: number | null;
    setGlobalFactionId: (id: number | null) => void;
    onConfirm: (name: string, factionId: number, points: number) => void;
    onCancel?: () => void;
    // Import support — if provided, shows an "Import from army code" section
    importCode?: string;
    importError?: string;
    onImportCodeChange?: (code: string) => void;
    onImportCode?: () => void;
}

export function NewListModal({
    db,
    globalFactionId,
    setGlobalFactionId,
    onConfirm,
    onCancel,
    importCode,
    importError,
    onImportCodeChange,
    onImportCode,
}: NewListModalProps) {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [points, setPoints] = useState(300);
    const [showImport, setShowImport] = useState(false);
    const groupedFactions = db.getGroupedFactions();
    const factionName = globalFactionId ? db.getFactionName(globalFactionId) : '';
    const defaultName = globalFactionId ? `New ${factionName} List` : '';
    const hasImportSupport = !!(onImportCode && onImportCodeChange !== undefined);

    const handleConfirm = () => {
        if (!globalFactionId) return;
        onConfirm(name.trim() || defaultName, globalFactionId, points);
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(4px)',
            }}
            onClick={onCancel}
        >
            <div
                style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-hover)',
                    borderRadius: '16px',
                    padding: '2rem',
                    width: '100%',
                    maxWidth: '440px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
                    margin: '0 1rem',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div>
                    <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Create Army List
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Choose your faction and give your list a name.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faction</label>
                    <CompactFactionSelector groupedFactions={groupedFactions} value={globalFactionId} onChange={setGlobalFactionId} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>List Name</label>
                    <input
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={defaultName || 'My Army List'}
                        onKeyDown={e => { if (e.key === 'Enter' && globalFactionId) handleConfirm(); }}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            borderRadius: '8px',
                            padding: '0.65rem 0.85rem',
                            fontSize: '0.9rem',
                            outline: 'none',
                        }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Points Limit</label>
                    <select
                        value={points}
                        onChange={e => setPoints(Number(e.target.value))}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            borderRadius: '8px',
                            padding: '0.65rem 0.85rem',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                        }}
                    >
                        {[150, 200, 250, 300, 400].map(p => <option key={p} value={p}>{p} pts</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {onCancel ? (
                        <button
                            onClick={onCancel}
                            style={{ padding: '0.6rem 1.1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                            Cancel
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate('/lists')}
                            style={{ padding: '0.6rem 1.1rem', borderRadius: '8px', border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                        >
                            My Lists
                        </button>
                    )}
                    <button
                        disabled={!globalFactionId}
                        onClick={handleConfirm}
                        style={{
                            padding: '0.6rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: globalFactionId ? 'var(--color-primary, #6366f1)' : 'var(--bg-secondary)',
                            color: '#fff',
                            cursor: globalFactionId ? 'pointer' : 'not-allowed',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            opacity: globalFactionId ? 1 : 0.5,
                            transition: 'all 0.15s',
                        }}
                    >
                        Create List
                    </button>
                </div>

                {/* Import section */}
                {hasImportSupport && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                        <button
                            onClick={() => setShowImport(v => !v)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                            <span style={{ fontWeight: 600 }}>{showImport ? '▾' : '▸'}</span>
                            Import from army code
                        </button>
                        {showImport && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <textarea
                                    value={importCode ?? ''}
                                    onChange={e => onImportCodeChange!(e.target.value)}
                                    placeholder="Paste army code here…"
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 0.85rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        resize: 'none',
                                        fontSize: '0.85rem',
                                        fontFamily: 'monospace',
                                        boxSizing: 'border-box',
                                        outline: 'none',
                                    }}
                                />
                                {importError && (
                                    <div style={{ color: 'var(--color-error, #ef4444)', fontSize: '0.8rem' }}>{importError}</div>
                                )}
                                <button
                                    disabled={!(importCode ?? '').trim()}
                                    onClick={onImportCode}
                                    style={{
                                        padding: '0.6rem 1rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: (importCode ?? '').trim() ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        cursor: (importCode ?? '').trim() ? 'pointer' : 'not-allowed',
                                        fontWeight: 600,
                                        fontSize: '0.875rem',
                                        opacity: (importCode ?? '').trim() ? 1 : 0.5,
                                    }}
                                >
                                    Import Code
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
