import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompactFactionSelector } from '../shared/CompactFactionSelector';
import type { useDatabase } from '../../hooks/useDatabase';

interface NewListModalProps {
    db: ReturnType<typeof useDatabase>;
    initialFactionId?: number | null;
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
    initialFactionId,
    onConfirm,
    onCancel,
    importCode,
    importError,
    onImportCodeChange,
    onImportCode,
}: NewListModalProps) {
    const navigate = useNavigate();
    const [selectedFactionId, setSelectedFactionId] = useState<number | null>(initialFactionId ?? null);
    const [name, setName] = useState('');
    const [points, setPoints] = useState(300);
    const [showImport, setShowImport] = useState(false);
    const groupedFactions = db.getGroupedFactions();
    const factionName = selectedFactionId ? db.getFactionName(selectedFactionId) : '';
    const defaultName = selectedFactionId ? `New ${factionName} List` : '';
    const hasImportSupport = !!(onImportCode && onImportCodeChange !== undefined);

    const handleConfirm = () => {
        if (!selectedFactionId) return;
        onConfirm(name.trim() || defaultName, selectedFactionId, points);
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
                    <h2 style={{ margin: '0 0 0.25rem', fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Create Army List
                    </h2>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        Choose your faction and give your list a name.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faction</label>
                    <CompactFactionSelector groupedFactions={groupedFactions} value={selectedFactionId} onChange={setSelectedFactionId} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>List Name</label>
                    <input
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={defaultName || 'My Army List'}
                        onKeyDown={e => { if (e.key === 'Enter' && selectedFactionId) handleConfirm(); }}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            borderRadius: '8px',
                            padding: '0.65rem 0.85rem',
                            fontSize: 'var(--text-md)',
                            outline: 'none',
                        }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Points Limit</label>
                    <select
                        value={points}
                        onChange={e => setPoints(Number(e.target.value))}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            borderRadius: '8px',
                            padding: '0.65rem 0.85rem',
                            fontSize: 'var(--text-md)',
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
                            style={{ padding: '0.6rem 1.1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--text-md)' }}
                        >
                            Cancel
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate('/lists')}
                            style={{ padding: '0.6rem 1.1rem', borderRadius: '8px', border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--text-md)', textDecoration: 'underline' }}
                        >
                            My Lists
                        </button>
                    )}
                    <button
                        disabled={!selectedFactionId}
                        onClick={handleConfirm}
                        style={{
                            padding: '0.6rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: selectedFactionId ? 'var(--color-primary, #6366f1)' : 'var(--bg-secondary)',
                            color: '#fff',
                            cursor: selectedFactionId ? 'pointer' : 'not-allowed',
                            fontWeight: 'var(--font-bold)',
                            fontSize: 'var(--text-md)',
                            opacity: selectedFactionId ? 1 : 0.5,
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
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--text-sm)', padding: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                            <span style={{ fontWeight: 'var(--font-semibold)' }}>{showImport ? '▾' : '▸'}</span>
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
                                        fontSize: 'var(--text-sm)',
                                        fontFamily: 'monospace',
                                        boxSizing: 'border-box',
                                        outline: 'none',
                                    }}
                                />
                                {importError && (
                                    <div style={{ color: 'var(--color-error, #ef4444)', fontSize: 'var(--text-sm)' }}>{importError}</div>
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
                                        fontWeight: 'var(--font-semibold)',
                                        fontSize: 'var(--text-md)',
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
