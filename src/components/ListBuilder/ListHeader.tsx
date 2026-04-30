// List Header with controls Component
import { Trash2, Copy, Check, ExternalLink, CloudUpload, CloudCheck } from 'lucide-react';
import type { ArmyList } from '../../../shared/listTypes';
import styles from '../../pages/ListBuilderPage.module.css';

interface ListHeaderProps {
    list: ArmyList;
    factionName: string;
    codeCopied: boolean;
    isSaving?: boolean;
    isSaved?: boolean;
    onPointsLimitChange: (limit: number) => void;
    onCopyCode: () => void;
    onReset: () => void;
    onOpenInArmy: () => void;
    onSaveList?: () => void;
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
    isSaving,
    isSaved
}: ListHeaderProps) {
    return (
        <div className={styles.listHeader}>
            <div className={styles.listInfo} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <h2>{list.name}</h2>
                <span style={{ color: '#475569', fontSize: '1rem' }}>|</span>
                <span className={styles.factionLabel}>{factionName}</span>
            </div>
            <div className={styles.headerActions}>
                <div className={styles.pointsControl}>
                    <label htmlFor="header-points">Points:</label>
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
                    <button className={styles.codeButton} onClick={onSaveList} disabled={isSaving} title="Save to My Lists">
                        {isSaved ? <CloudCheck size={16} /> : <CloudUpload size={16} className={isSaving ? 'animate-pulse' : ''} />}
                        {isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save List'}
                    </button>
                )}
                <button className={styles.codeButton} onClick={onOpenInArmy} title="Open list in official Infinity Army app">
                    <ExternalLink size={16} />
                    Open in Infinity Army
                </button>
                <button className={styles.codeButton} onClick={onCopyCode}>
                    {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                    {codeCopied ? 'Copied!' : 'Copy Code'}
                </button>
                <button className={styles.resetButton} onClick={onReset}>
                    <Trash2 size={16} />
                    Start Over
                </button>
            </div>
        </div>
    );
}
