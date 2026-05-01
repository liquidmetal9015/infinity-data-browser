// List Header with controls Component
import { Trash2, Copy, Check, CloudUpload, CloudCheck, GitBranch } from 'lucide-react';
import type { ArmyList } from '../../../shared/listTypes';
import { ArmyLogo } from '../shared/ArmyLogo';
import styles from '../../pages/ListBuilderPage.module.css';

interface ListHeaderProps {
    list: ArmyList;
    factionName: string;
    codeCopied: boolean;
    isSaving?: boolean;
    isSaved?: boolean;
    hasUnsavedChanges?: boolean;
    onPointsLimitChange: (limit: number) => void;
    onCopyCode: () => void;
    onReset: () => void;
    onOpenInArmy: () => void;
    onSaveList?: () => void;
    onSaveAsCopy?: () => void;
}

export function ListHeader({
    list,
    factionName,
    codeCopied,
    onPointsLimitChange,
    onCopyCode,
    onReset,
    onOpenInArmy,
    onSaveList,
    onSaveAsCopy,
    isSaving,
    isSaved,
    hasUnsavedChanges,
}: ListHeaderProps) {
    const showUnsaved = hasUnsavedChanges && !isSaving && !isSaved;

    return (
        <div className={styles.listHeader}>
            <div className={styles.listInfo} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</h2>
                    <span className={styles.factionLabel}>{factionName}</span>
                </div>
                {showUnsaved && (
                    <span className={styles.unsavedBadge} title="You have unsaved changes">
                        Unsaved
                    </span>
                )}
            </div>

            <div className={styles.headerActions}>
                <div className={styles.pointsControl}>
                    <label htmlFor="header-points">Points</label>
                    <select
                        id="header-points"
                        className={styles.pointsDropdownInline}
                        value={list.pointsLimit}
                        onChange={e => onPointsLimitChange(Number(e.target.value))}
                    >
                        <option value={150}>150</option>
                        <option value={200}>200</option>
                        <option value={250}>250</option>
                        <option value={300}>300</option>
                        <option value={400}>400</option>
                    </select>
                </div>

                {onSaveList && (
                    <button
                        className={showUnsaved ? styles.saveButtonUnsaved : styles.saveButton}
                        onClick={onSaveList}
                        disabled={isSaving}
                        title={list.serverId ? 'Save changes' : 'Save to My Lists'}
                    >
                        {isSaved
                            ? <CloudCheck size={18} />
                            : <CloudUpload size={18} className={isSaving ? 'animate-pulse' : ''} />
                        }
                        {isSaving ? 'Saving…' : isSaved ? 'Saved' : 'Save List'}
                    </button>
                )}

                {onSaveAsCopy && list.serverId && (
                    <button
                        className={styles.copyButton}
                        onClick={onSaveAsCopy}
                        title="Save a new copy of this list"
                    >
                        <GitBranch size={18} />
                        Save as Copy
                    </button>
                )}

                <button className={styles.armyButton} onClick={onOpenInArmy} title="Open in official Infinity Army app">
                    <ArmyLogo size={18} backdrop />
                    Open in Army
                </button>

                <button className={styles.codeButton} onClick={onCopyCode}>
                    {codeCopied ? <Check size={18} /> : <Copy size={18} />}
                    {codeCopied ? 'Copied!' : 'Copy Code'}
                </button>

                <button className={styles.resetButton} onClick={onReset} title="Discard this list and start over">
                    <Trash2 size={18} />
                    Start Over
                </button>
            </div>
        </div>
    );
}
