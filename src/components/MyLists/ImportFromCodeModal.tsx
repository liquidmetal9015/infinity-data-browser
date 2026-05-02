import { useState } from 'react';
import { parseArmyCodes } from '../../utils/listImport';

export function ImportFromCodeModal({ onImport, onCancel }: {
    onImport: (codes: string[]) => Promise<void>;
    onCancel: () => void;
}) {
    const [raw, setRaw] = useState('');
    const [error, setError] = useState('');
    const [importing, setImporting] = useState(false);

    const codes = parseArmyCodes(raw);

    const handleSubmit = async () => {
        setError('');
        setImporting(true);
        try {
            await onImport(codes);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Import failed — check that all codes are valid.');
        } finally {
            setImporting(false);
        }
    };

    const placeholder = `Paste one or more army codes, one per line or comma-separated:\n\nABC123...\nDEF456...\nGHI789...`;

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
            onClick={onCancel}
        >
            <div
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.75rem', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
                onClick={e => e.stopPropagation()}
            >
                <div>
                    <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Import from Army Code</h2>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Paste one or more codes from Infinity Army. Separate multiple codes with commas or newlines.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Army Code(s)</label>
                        {codes.length > 1 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                                {codes.length} lists detected
                            </span>
                        )}
                    </div>
                    <textarea
                        autoFocus
                        value={raw}
                        onChange={e => { setRaw(e.target.value); setError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && codes.length > 0) handleSubmit(); }}
                        placeholder={placeholder}
                        rows={6}
                        style={{
                            background: 'var(--bg-primary)',
                            border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                            color: 'var(--text-primary)',
                            borderRadius: '8px',
                            padding: '0.6rem 0.75rem',
                            fontSize: '0.78rem',
                            fontFamily: 'monospace',
                            resize: 'vertical',
                            width: '100%',
                            boxSizing: 'border-box',
                        }}
                    />
                    {error && <p style={{ margin: 0, fontSize: '0.78rem', color: '#ef4444' }}>{error}</p>}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} disabled={importing} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: importing ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: importing ? 0.5 : 1 }}>
                        Cancel
                    </button>
                    <button
                        disabled={codes.length === 0 || importing}
                        onClick={handleSubmit}
                        style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', background: codes.length > 0 && !importing ? '#10b981' : 'var(--bg-tertiary)', color: '#fff', cursor: codes.length > 0 && !importing ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.875rem', opacity: codes.length > 0 && !importing ? 1 : 0.5 }}>
                        {importing ? 'Importing…' : `Import ${codes.length > 1 ? `${codes.length} Lists` : 'List'}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
