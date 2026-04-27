// List Header with controls Component
import { Trash2, Copy, Check, ExternalLink, CloudUpload } from 'lucide-react';
import type { ArmyList } from '../../../shared/listTypes';

interface ListHeaderProps {
    list: ArmyList;
    factionName: string;
    codeCopied: boolean;
    isSaving?: boolean;
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
    isSaving
}: ListHeaderProps) {
    return (
        <div className="list-header">
            <div className="list-info" style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <h2>{list.name}</h2>
                <span style={{ color: '#475569', fontSize: '1rem' }}>|</span>
                <span className="faction-label">{factionName}</span>
            </div>
            <div className="header-actions">
                <div className="points-control">
                    <label htmlFor="header-points">Points:</label>
                    <select
                        id="header-points"
                        className="points-dropdown-inline"
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
                    <button className="code-button" onClick={onSaveList} disabled={isSaving} title="Save to My Lists">
                        <CloudUpload size={16} className={isSaving ? 'animate-pulse' : ''} />
                        {isSaving ? 'Saving...' : 'Save List'}
                    </button>
                )}
                <button className="code-button" onClick={onOpenInArmy} title="Open list in official Infinity Army app">
                    <ExternalLink size={16} />
                    Open in Infinity Army
                </button>
                <button className="code-button" onClick={onCopyCode}>
                    {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                    {codeCopied ? 'Copied!' : 'Copy Code'}
                </button>
                <button className="reset-button" onClick={onReset}>
                    <Trash2 size={16} />
                    Start Over
                </button>
            </div>
        </div>
    );
}
