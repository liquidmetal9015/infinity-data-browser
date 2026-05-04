import { useEffect, useState } from 'react';
import { CloudCheck, CloudUpload, Copy, Check, Trash2, GitBranch, RotateCcw, MoreHorizontal } from 'lucide-react';
import { KebabMenu, KebabItem } from '../MyLists/KebabMenu';
import { ArmyLogo } from '../shared/ArmyLogo';

type SaveState = 'saved' | 'dirty' | 'saving';

function formatRelative(ms: number, now: number): string {
    const diff = Math.max(0, now - ms);
    if (diff < 10_000) return 'just now';
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return `${Math.floor(diff / 86400_000)}d ago`;
}

interface SaveStatusPillProps {
    saveState: SaveState;
    lastSavedAt: number | null;
    onSaveNow: () => void;
}

export function SaveStatusPill({ saveState, lastSavedAt, onSaveNow }: SaveStatusPillProps) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(id);
    }, []);

    const palette = saveState === 'dirty'
        ? { color: '#f59e0b', border: 'rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.10)' }
        : saveState === 'saving'
            ? { color: '#60a5fa', border: 'rgba(96,165,250,0.35)', bg: 'rgba(96,165,250,0.10)' }
            : { color: '#10b981', border: 'rgba(16,185,129,0.35)', bg: 'rgba(16,185,129,0.10)' };

    const label = saveState === 'saving'
        ? 'Saving…'
        : saveState === 'dirty'
            ? 'Save now'
            : lastSavedAt ? `Saved · ${formatRelative(lastSavedAt, now)}` : 'Saved';

    const icon = saveState === 'saving'
        ? <CloudUpload size={13} className="animate-pulse" />
        : saveState === 'dirty'
            ? <CloudUpload size={13} />
            : <CloudCheck size={13} />;

    const clickable = saveState === 'dirty';
    const title = saveState === 'saving'
        ? 'Saving…'
        : saveState === 'dirty'
            ? 'Click to save now'
            : lastSavedAt ? `Last saved ${formatRelative(lastSavedAt, now)}` : 'Saved';

    return (
        <button
            onClick={clickable ? onSaveNow : undefined}
            disabled={!clickable}
            title={title}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.55rem',
                border: `1px solid ${palette.border}`,
                background: palette.bg,
                color: palette.color,
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: clickable ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
            }}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

interface DiscardButtonProps {
    onDiscard: () => void;
}

export function DiscardButton({ onDiscard }: DiscardButtonProps) {
    return (
        <button
            onClick={onDiscard}
            title="Discard changes — reload from server"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: '1px solid rgba(239,68,68,0.35)',
                background: 'rgba(239,68,68,0.08)',
                color: '#ef4444',
                borderRadius: '6px',
                cursor: 'pointer',
            }}
        >
            <RotateCcw size={13} />
        </button>
    );
}

interface ListOverflowMenuProps {
    pointsLimit: number;
    onPointsLimitChange: (limit: number) => void;
    codeCopied: boolean;
    onCopyCode: () => void;
    onOpenInArmy: () => void;
    onFork: () => void;
    onReset: () => void;
}

export function ListOverflowMenu({
    pointsLimit, onPointsLimitChange,
    codeCopied, onCopyCode, onOpenInArmy, onFork, onReset,
}: ListOverflowMenuProps) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button
                onClick={() => setOpen(o => !o)}
                title="More actions"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    border: '1px solid var(--border)',
                    background: 'var(--surface, rgba(255,255,255,0.03))',
                    color: 'var(--text-secondary)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                }}
            >
                <MoreHorizontal size={15} />
            </button>
            {open && (
                <KebabMenu onClose={() => setOpen(false)}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.35rem 0.6rem', gap: '0.5rem',
                    }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Points limit</span>
                        <select
                            value={pointsLimit}
                            onChange={e => onPointsLimitChange(Number(e.target.value))}
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                borderRadius: '4px',
                                padding: '0.15rem 0.35rem',
                                fontSize: '0.75rem',
                            }}
                        >
                            <option value={150}>150</option>
                            <option value={200}>200</option>
                            <option value={250}>250</option>
                            <option value={300}>300</option>
                            <option value={400}>400</option>
                        </select>
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', margin: '0.15rem 0' }} />
                    <KebabItem color="#F29107" onClick={() => { onOpenInArmy(); setOpen(false); }}>
                        <ArmyLogo size={13} backdrop /> Open in Infinity Army
                    </KebabItem>
                    <KebabItem color="var(--text-secondary)" onClick={() => { onCopyCode(); setOpen(false); }}>
                        {codeCopied ? <Check size={13} /> : <Copy size={13} />} {codeCopied ? 'Copied!' : 'Copy army code'}
                    </KebabItem>
                    <KebabItem color="#6366f1" onClick={() => { onFork(); setOpen(false); }}>
                        <GitBranch size={13} /> Fork list
                    </KebabItem>
                    <div style={{ height: 1, background: 'var(--border)', margin: '0.15rem 0' }} />
                    <KebabItem color="#ef4444" onClick={() => { onReset(); setOpen(false); }}>
                        <Trash2 size={13} /> Clear list
                    </KebabItem>
                </KebabMenu>
            )}
        </div>
    );
}
