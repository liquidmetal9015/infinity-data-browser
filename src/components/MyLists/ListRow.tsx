import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { ArmyLogo } from '../shared/ArmyLogo';
import { StarRating } from './StarRating';
import { KebabMenu, KebabItem } from './KebabMenu';
import { ListUnitsSummary } from './ListUnitsSummary';
import { TagBadge } from './TagBadge';
import type { ListSummary } from '../../services/listService';
import type { ArmyList } from '@shared/listTypes';
import type { FactionInfo } from '@shared/types';
import styles from '../../pages/MyLists.module.css';

interface ListRowProps {
    list: ListSummary;
    factionInfo: FactionInfo | undefined;
    logoSrc: string | undefined;
    factionName: string;
    updatedDate: string;
    fullListFallback: ArmyList | undefined;

    selected: boolean;
    onToggleSelect: () => void;

    isExpanded: boolean;
    onToggleExpand: () => void;

    isLoading: boolean;
    onLoad: () => void;

    isOpeningInArmy: boolean;
    onOpenInArmy: () => void;

    isForking: boolean;
    onFork: () => void;

    onFindSimilar: () => void;

    isDeleting: boolean;
    onDelete: () => void;

    isRenaming: boolean;
    renameValue: string;
    onRenameStart: () => void;
    onRenameChange: (v: string) => void;
    onRenameCommit: () => void;
    onRenameCancel: () => void;

    isEditingTags: boolean;
    tagInput: string;
    onTagsEditStart: () => void;
    onTagsInputChange: (v: string) => void;
    onTagsCommit: () => void;
    onTagsCancel: () => void;
    onTagRemove: (tag: string) => void;

    isEditingNotes: boolean;
    notesValue: string;
    onNotesEditStart: () => void;
    onNotesChange: (v: string) => void;
    onNotesCommit: () => void;
    onNotesCancel: () => void;

    isKebabOpen: boolean;
    onKebabToggle: () => void;
    onKebabClose: () => void;

    onRatingChange: (rating: number) => void;
}

export function ListRow(props: ListRowProps) {
    const {
        list, factionInfo, logoSrc, factionName, updatedDate, fullListFallback,
        selected, onToggleSelect, isExpanded, onToggleExpand,
        isLoading, onLoad, isOpeningInArmy, onOpenInArmy,
        isForking, onFork, onFindSimilar, isDeleting, onDelete,
        isRenaming, renameValue, onRenameStart, onRenameChange, onRenameCommit, onRenameCancel,
        isEditingTags, tagInput, onTagsEditStart, onTagsInputChange, onTagsCommit, onTagsCancel, onTagRemove,
        isEditingNotes, notesValue, onNotesEditStart, onNotesChange, onNotesCommit, onNotesCancel,
        isKebabOpen, onKebabToggle, onKebabClose, onRatingChange,
    } = props;

    const tags = list.tags ?? [];
    const inlineTags = tags.slice(0, 3);
    const overflowCount = tags.length - inlineTags.length;
    const notes = list.notes ?? '';

    return (
        <div className={styles.row}>
            {/* Collapsed row (always visible) */}
            <div className={styles.rowCollapsed}>
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onToggleSelect}
                    title="Select for compare"
                    className={styles.checkbox}
                />

                <button
                    onClick={onToggleExpand}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                    className={styles.expandToggle}
                >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <div className={styles.factionLogo}>
                    {logoSrc ? (
                        <img
                            src={logoSrc}
                            alt={factionInfo?.name}
                            title={factionInfo?.name}
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                    ) : (
                        <div className={styles.factionLogoFallback}>
                            {(factionInfo?.shortName || factionInfo?.name || '?')[0]}
                        </div>
                    )}
                </div>

                <div className={styles.nameCell}>
                    {isRenaming ? (
                        <input
                            autoFocus
                            value={renameValue}
                            onChange={e => onRenameChange(e.target.value)}
                            onBlur={onRenameCommit}
                            onKeyDown={e => {
                                if (e.key === 'Enter') onRenameCommit();
                                if (e.key === 'Escape') onRenameCancel();
                            }}
                            className={styles.nameInput}
                        />
                    ) : (
                        <div
                            onClick={onRenameStart}
                            title={list.name}
                            className={styles.nameDisplay}
                        >
                            {list.name}
                            {notes && (
                                <span className={styles.notesPreview} title={notes}>
                                    — {notes.length > 60 ? notes.slice(0, 60) + '…' : notes}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className={styles.stats}>
                    <span>{list.points}<span className={styles.statsSwc}>/{list.swc}</span></span>
                    <span className={styles.statsDot}>·</span>
                    <span>{list.unit_count ?? 0}u</span>
                </div>

                {tags.length > 0 && (
                    <div className={styles.inlineTagList}>
                        {inlineTags.map(tag => <TagBadge key={tag} tag={tag} />)}
                        {overflowCount > 0 && (
                            <span className={styles.tagOverflow}>+{overflowCount}</span>
                        )}
                    </div>
                )}

                <StarRating value={list.rating ?? 0} onChange={onRatingChange} />

                <button
                    onClick={onLoad}
                    disabled={isLoading}
                    className={styles.loadBtn}
                >
                    {isLoading ? '…' : 'Load'}
                </button>

                <div className={styles.kebabWrap}>
                    <button
                        onClick={onKebabToggle}
                        title="More actions"
                        className={styles.kebabBtn}
                    >
                        <MoreHorizontal size={14} />
                    </button>
                    {isKebabOpen && (
                        <KebabMenu onClose={onKebabClose}>
                            <KebabItem
                                color="#F29107"
                                disabled={isOpeningInArmy}
                                onClick={() => { onKebabClose(); onOpenInArmy(); }}
                            >
                                <ArmyLogo size={12} backdrop />
                                {isOpeningInArmy ? 'Opening…' : 'Open in Army'}
                            </KebabItem>
                            <KebabItem
                                color="#6366f1"
                                disabled={isForking}
                                onClick={() => { onKebabClose(); onFork(); }}
                            >
                                Fork
                            </KebabItem>
                            <KebabItem
                                color="#a78bfa"
                                onClick={() => { onKebabClose(); onFindSimilar(); }}
                            >
                                Find similar
                            </KebabItem>
                            <KebabItem
                                color="#ef4444"
                                disabled={isDeleting}
                                onClick={() => { onKebabClose(); onDelete(); }}
                            >
                                Delete
                            </KebabItem>
                        </KebabMenu>
                    )}
                </div>
            </div>

            {/* Expanded panel */}
            {isExpanded && (
                <div className={styles.expandedPanel}>
                    {/* Notes */}
                    <div>
                        <div className={styles.sectionLabel}>Notes</div>
                        {isEditingNotes ? (
                            <textarea
                                autoFocus
                                value={notesValue}
                                onChange={e => onNotesChange(e.target.value)}
                                onBlur={onNotesCommit}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onNotesCommit();
                                    if (e.key === 'Escape') onNotesCancel();
                                }}
                                placeholder="Notes about this list — strategy, opponent, occasion…"
                                rows={3}
                                className={styles.notesTextarea}
                            />
                        ) : (
                            <div
                                onClick={onNotesEditStart}
                                title="Click to edit"
                                className={clsx(
                                    styles.notesDisplay,
                                    notes ? styles.notesDisplayFilled : styles.notesDisplayEmpty,
                                )}
                            >
                                {notes || 'Click to add notes…'}
                            </div>
                        )}
                    </div>

                    {/* Units summary */}
                    <div>
                        <div className={styles.sectionLabel}>Units</div>
                        <ListUnitsSummary listId={list.id} fallback={fullListFallback} />
                    </div>

                    {/* Tags editor */}
                    <div>
                        <div className={styles.sectionLabel}>Tags</div>
                        <div className={styles.tagsEditor}>
                            {tags.map(tag => (
                                <TagBadge key={tag} tag={tag} onRemove={() => onTagRemove(tag)} />
                            ))}
                            {isEditingTags ? (
                                <input
                                    autoFocus
                                    value={tagInput}
                                    onChange={e => onTagsInputChange(e.target.value)}
                                    onBlur={onTagsCommit}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') onTagsCommit();
                                        if (e.key === 'Escape') onTagsCancel();
                                    }}
                                    placeholder="tag1, tag2, …"
                                    className={styles.tagInput}
                                />
                            ) : (
                                <button
                                    onClick={onTagsEditStart}
                                    className={styles.tagAddBtn}
                                >
                                    + tag
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Meta */}
                    <div className={styles.metaRow}>
                        <span className={styles.metaFaction}>{factionName}</span>
                        <span>·</span>
                        <span>Updated {updatedDate}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
