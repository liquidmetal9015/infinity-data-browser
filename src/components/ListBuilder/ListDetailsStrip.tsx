import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ListDetailsStripProps {
    expanded: boolean;
    onToggle: () => void;
    notes: string;
    onNotesChange: (notes: string) => void;
    tags: string[];
    onTagsChange: (tags: string[]) => void;
}

export function ListDetailsStrip({
    expanded, onToggle, notes, onNotesChange, tags, onTagsChange,
}: ListDetailsStripProps) {
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesDraft, setNotesDraft] = useState('');
    const [editingTags, setEditingTags] = useState(false);
    const [tagDraft, setTagDraft] = useState('');

    const summaryBits: string[] = [];
    if (notes.trim()) summaryBits.push('notes');
    if (tags.length > 0) summaryBits.push(`${tags.length} tag${tags.length === 1 ? '' : 's'}`);
    const summaryText = summaryBits.length > 0 ? summaryBits.join(' · ') : 'add notes or tags';

    return (
        <div style={{
            flexShrink: 0,
            borderBottom: '1px solid var(--border-subtle, var(--border))',
            background: 'var(--bg-primary)',
        }}>
            <button
                onClick={onToggle}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.3rem 0.75rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary, #64748b)',
                    fontSize: 'var(--text-2xs)',
                    fontWeight: 'var(--font-semibold)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>Details</span>
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary, #64748b)' }}>
                    · {summaryText}
                </span>
            </button>

            {expanded && (
                <div style={{ padding: '0.25rem 0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {/* Notes */}
                    <div>
                        <div style={{
                            fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-semibold)', color: 'var(--text-tertiary, #64748b)',
                            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem',
                        }}>
                            Notes
                        </div>
                        {editingNotes ? (
                            <textarea
                                autoFocus
                                value={notesDraft}
                                onChange={e => setNotesDraft(e.target.value)}
                                onBlur={() => {
                                    if (notesDraft !== notes) onNotesChange(notesDraft);
                                    setEditingNotes(false);
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                        if (notesDraft !== notes) onNotesChange(notesDraft);
                                        setEditingNotes(false);
                                    }
                                    if (e.key === 'Escape') setEditingNotes(false);
                                }}
                                placeholder="Strategy, opponent, occasion, lessons learned…"
                                rows={3}
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--accent)',
                                    color: 'var(--text-primary)',
                                    borderRadius: '6px',
                                    padding: '0.4rem 0.55rem',
                                    fontSize: 'var(--text-sm)',
                                    resize: 'vertical',
                                    fontFamily: 'inherit',
                                }}
                            />
                        ) : (
                            <div
                                onClick={() => { setNotesDraft(notes); setEditingNotes(true); }}
                                title="Click to edit"
                                style={{
                                    fontSize: 'var(--text-sm)',
                                    color: notes ? 'var(--text-secondary)' : 'var(--text-tertiary, #64748b)',
                                    fontStyle: notes ? 'normal' : 'italic',
                                    cursor: 'text',
                                    whiteSpace: 'pre-wrap',
                                    minHeight: '1.2em',
                                    padding: '0.3rem 0.45rem',
                                    borderRadius: '6px',
                                    border: '1px dashed var(--border)',
                                }}
                            >
                                {notes || 'Click to add notes…'}
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    <div>
                        <div style={{
                            fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-semibold)', color: 'var(--text-tertiary, #64748b)',
                            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem',
                        }}>
                            Tags
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem' }}>
                            {tags.map(tag => (
                                <span
                                    key={tag}
                                    onClick={() => onTagsChange(tags.filter(t => t !== tag))}
                                    title="Click to remove"
                                    style={{
                                        padding: '0.1rem 0.5rem',
                                        borderRadius: '20px',
                                        fontSize: 'var(--text-2xs)',
                                        fontWeight: 'var(--font-medium)',
                                        background: 'rgba(99,102,241,0.1)',
                                        border: '1px solid rgba(99,102,241,0.25)',
                                        color: '#a5b4fc',
                                        cursor: 'pointer',
                                    }}
                                >
                                    #{tag}
                                </span>
                            ))}
                            {editingTags ? (
                                <input
                                    autoFocus
                                    value={tagDraft}
                                    onChange={e => setTagDraft(e.target.value)}
                                    onBlur={() => {
                                        onTagsChange(tagDraft.split(',').map(t => t.trim()).filter(Boolean));
                                        setEditingTags(false);
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            onTagsChange(tagDraft.split(',').map(t => t.trim()).filter(Boolean));
                                            setEditingTags(false);
                                        }
                                        if (e.key === 'Escape') setEditingTags(false);
                                    }}
                                    placeholder="tag1, tag2, …"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--accent)',
                                        color: 'var(--text-primary)',
                                        borderRadius: '4px',
                                        padding: '0.1rem 0.4rem',
                                        fontSize: 'var(--text-2xs)',
                                        width: '140px',
                                    }}
                                />
                            ) : (
                                <button
                                    onClick={() => { setTagDraft(tags.join(', ')); setEditingTags(true); }}
                                    style={{
                                        padding: '0.1rem 0.5rem',
                                        borderRadius: '20px',
                                        fontSize: 'var(--text-2xs)',
                                        border: '1px dashed var(--border)',
                                        background: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    + tag
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
