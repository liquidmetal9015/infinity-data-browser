import { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useList } from '../context/ListContext';
import { useModal } from '../context/ModalContext';
import { ListDashboard } from '../components/ListBuilder/ListDashboard';
import { Trash2, ChevronRight, Copy, Check, Upload, X, Shield } from 'lucide-react';
import { encodeArmyList, copyArmyCodeToClipboard, decodeArmyCode } from '../utils/armyCode';
import type { Unit } from '../types';

export function ListBuilderPage() {
    const db = useDatabase();
    const { state, createList, addUnit, resetList, updatePointsLimit, addCombatGroup } = useList();
    const { openUnitModal } = useModal();
    const [codeCopied, setCodeCopied] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importCode, setImportCode] = useState('');
    const [importError, setImportError] = useState('');

    const groupedFactions = db.getGroupedFactions();

    const handleFactionClick = (factionId: number) => {
        const factionName = db.getFactionName(factionId);
        createList(factionId, factionName, 300);
    };

    const handleImportCode = () => {
        setImportError('');

        try {
            const decoded = decodeArmyCode(importCode.trim());

            // Create the list with decoded faction, points and name
            createList(decoded.factionId, decoded.factionSlug || 'Unknown', decoded.maxPoints, decoded.armyName);

            // For each combat group and member, find the unit and add it
            // Note: This is a simplified import - it matches by unit ID
            decoded.combatGroups.forEach((group, index) => {
                // If this is group 2 or later (index > 0), we need to add a combat group
                if (index > 0) {
                    addCombatGroup();
                }

                group.members.forEach(member => {
                    // Find unit by ID (check both internal ID and idArmy)
                    const unit = db.units.find(u => u.id === member.unitId || u.idArmy === member.unitId);

                    if (unit) {
                        // Add unit to the correct group
                        addUnit(
                            unit,
                            index,
                            member.groupChoice,
                            member.groupChoice, // Use groupChoice as profileId placeholder if needed?
                            member.optionChoice
                        );
                    }
                });
            });

            setShowImportModal(false);
            setImportCode('');
        } catch (error) {
            console.error('Import error:', error);
            setImportError('Invalid army code format. Please check and try again.');
        }
    };

    const handleCopyCode = async () => {
        if (!state.currentList) return;

        // Get faction info to get the slug (official format uses slug)
        const faction = db.getFactionInfo(state.currentList.factionId);
        const factionSlug = faction?.slug || 'unknown';

        const code = encodeArmyList(
            state.currentList,
            factionSlug,
            (unit) => unit.idArmy || unit.id
        );

        await copyArmyCodeToClipboard(code);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };


    // If a list exists, show the Dashboard
    if (state.currentList) {
        return (
            <div className="list-builder-page">
                <div className="list-header">
                    <div className="list-info">
                        <h2>{state.currentList.name}</h2>
                        <span className="faction-label">{db.getFactionName(state.currentList.factionId)}</span>
                    </div>
                    <div className="header-actions">
                        <div className="points-control">
                            <label htmlFor="header-points">Points:</label>
                            <select
                                id="header-points"
                                className="points-dropdown-inline"
                                value={state.currentList.pointsLimit}
                                onChange={e => updatePointsLimit(Number(e.target.value))}
                            >
                                <option value={150}>150</option>
                                <option value={200}>200</option>
                                <option value={250}>250</option>
                                <option value={300}>300</option>
                                <option value={400}>400</option>
                            </select>
                        </div>
                        <button className="code-button" onClick={handleCopyCode}>
                            {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                            {codeCopied ? 'Copied!' : 'Copy Code'}
                        </button>
                        <button className="reset-button" onClick={resetList}>
                            <Trash2 size={16} />
                            Start Over
                        </button>
                    </div>
                </div>

                <ListDashboard
                    list={state.currentList}
                    onViewUnit={(unit: Unit) => {
                        openUnitModal(unit);
                    }}
                />

                <style>{`
                    .list-builder-page {
                        padding: 2rem;
                        max-width: 1400px;
                        margin: 0 auto;
                        min-height: 80vh;
                    }
                    .list-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 2rem;
                        background: var(--surface-elevated);
                        padding: 1.5rem;
                        border-radius: 12px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                        border: 1px solid var(--border-subtle);
                    }
                    .list-info h2 {
                        margin: 0 0 0.5rem 0;
                        color: var(--text-primary);
                        font-family: 'Oxanium', sans-serif;
                        font-size: 2rem;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .faction-label {
                        color: var(--color-primary);
                        font-size: 1rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .header-actions {
                        display: flex;
                        align-items: center;
                        gap: 1.5rem;
                    }
                    .points-control {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        background: var(--surface-base);
                        padding: 0.5rem 1rem;
                        border-radius: 8px;
                        border: 1px solid var(--border-subtle);
                    }
                    .points-control label {
                        font-size: 0.875rem;
                        color: var(--text-secondary);
                        font-weight: 500;
                    }
                    .points-dropdown-inline {
                        background: var(--surface-elevated);
                        color: var(--text-primary);
                        border: 1px solid var(--border-default);
                        padding: 0.4rem 0.75rem;
                        border-radius: 6px;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                    }
                    .points-dropdown-inline:focus {
                        outline: none;
                        border-color: var(--color-primary);
                    }
                    .code-button {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        padding: 0.75rem 1.25rem;
                        background: rgba(34, 197, 94, 0.1);
                        color: #22c55e;
                        border: 1px solid rgba(34, 197, 94, 0.3);
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 0.875rem;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    }
                    .code-button:hover {
                        background: rgba(34, 197, 94, 0.2);
                        transform: translateY(-1px);
                    }
                    .reset-button {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        padding: 0.75rem 1.25rem;
                        background: rgba(var(--color-error-rgb), 0.1);
                        color: var(--color-error);
                        border: 1px solid rgba(var(--color-error-rgb), 0.3);
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 0.875rem;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    }
                    .reset-button:hover {
                        background: rgba(var(--color-error-rgb), 0.2);
                        transform: translateY(-1px);
                    }
                `}</style>
            </div>
        );
    }

    // Faction Selection View
    return (
        <div className="list-builder-page">
            <div className="faction-selector-hero">
                <h1>Army Builder</h1>
                <p>Select a faction to begin, or import an existing army code</p>
                <button className="import-btn" onClick={() => setShowImportModal(true)}>
                    <Upload size={18} />
                    Import Army Code
                </button>
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="import-modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="import-modal" onClick={e => e.stopPropagation()}>
                        <div className="import-modal-header">
                            <h3>Import Army Code</h3>
                            <button className="close-btn" onClick={() => setShowImportModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="import-modal-body">
                            <p>Paste an army code from the official Infinity Army builder:</p>
                            <textarea
                                value={importCode}
                                onChange={e => setImportCode(e.target.value)}
                                placeholder="Paste army code here..."
                                rows={4}
                            />
                            {importError && <div className="import-error">{importError}</div>}
                        </div>
                        <div className="import-modal-footer">
                            <button className="cancel-btn" onClick={() => setShowImportModal(false)}>
                                Cancel
                            </button>
                            <button className="import-confirm-btn" onClick={handleImportCode} disabled={!importCode.trim()}>
                                Import List
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="faction-grid-container">
                {groupedFactions.map(superFaction => (
                    <div key={superFaction.id} className="super-faction-card">
                        <div className="super-faction-header">
                            <div className="faction-icon">
                                <Shield size={24} />
                            </div>
                            <h3>{superFaction.name}</h3>
                        </div>

                        <div className="sectorial-list">
                            {/* Vanilla Option */}
                            {superFaction.vanilla && (
                                <button
                                    className="sectorial-btn vanilla"
                                    onClick={() => handleFactionClick(superFaction.vanilla!.id)}
                                >
                                    <span className="btn-label">Vanilla / General</span>
                                    <ChevronRight size={16} />
                                </button>
                            )}

                            {/* Sectorials */}
                            {superFaction.sectorials.map(faction => (
                                <button
                                    key={faction.id}
                                    className="sectorial-btn"
                                    onClick={() => handleFactionClick(faction.id)}
                                >
                                    <span className="btn-label">{faction.name}</span>
                                    {faction.discontinued && <span className="tag-disc">Legacy</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                .list-builder-page {
                    padding: 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .faction-selector-hero {
                    text-align: center;
                    margin-bottom: 3rem;
                    padding: 3rem 1rem;
                    background: linear-gradient(180deg, rgba(30, 41, 59, 0) 0%, rgba(30, 41, 59, 0.5) 100%);
                    border-bottom: 1px solid var(--border-subtle);
                }
                .faction-selector-hero h1 {
                    font-size: 3rem;
                    margin: 0 0 1rem 0;
                    background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-family: 'Oxanium', sans-serif;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }
                .faction-selector-hero p {
                    color: var(--text-secondary);
                    font-size: 1.2rem;
                    margin-bottom: 1.5rem;
                }
                .import-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.875rem 1.5rem;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .import-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
                }

                /* Import Modal */
                .import-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }
                .import-modal {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 500px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                }
                .import-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid #334155;
                }
                .import-modal-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    color: #f1f5f9;
                }
                .close-btn {
                    background: none;
                    border: none;
                    color: #64748b;
                    cursor: pointer;
                    padding: 0.25rem;
                }
                .close-btn:hover {
                    color: #f1f5f9;
                }
                .import-modal-body {
                    padding: 1.25rem;
                }
                .import-modal-body p {
                    margin: 0 0 1rem 0;
                    font-size: 0.9rem;
                    color: #94a3b8;
                }
                .import-modal-body textarea {
                    width: 100%;
                    padding: 0.75rem;
                    background: #0d1117;
                    border: 1px solid #334155;
                    border-radius: 8px;
                    color: #f1f5f9;
                    font-family: monospace;
                    font-size: 0.85rem;
                    resize: vertical;
                }
                .import-modal-body textarea:focus {
                    outline: none;
                    border-color: #3b82f6;
                }
                .import-error {
                    margin-top: 0.75rem;
                    padding: 0.75rem;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 6px;
                    color: #ef4444;
                    font-size: 0.85rem;
                }
                .import-modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    padding: 1rem 1.25rem;
                    border-top: 1px solid #334155;
                }
                .cancel-btn {
                    padding: 0.625rem 1rem;
                    background: transparent;
                    border: 1px solid #334155;
                    border-radius: 6px;
                    color: #94a3b8;
                    cursor: pointer;
                    font-size: 0.875rem;
                }
                .cancel-btn:hover {
                    background: #334155;
                    color: #f1f5f9;
                }
                .import-confirm-btn {
                    padding: 0.625rem 1.25rem;
                    background: #3b82f6;
                    border: none;
                    border-radius: 6px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 0.875rem;
                }
                .import-confirm-btn:hover:not(:disabled) {
                    background: #2563eb;
                }
                .import-confirm-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .faction-grid-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 1.5rem;
                }

                .super-faction-card {
                    background: var(--surface-elevated);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    overflow: hidden;
                    transition: all 0.3s ease;
                    display: flex;
                    flex-direction: column;
                }
                .super-faction-card:hover {
                    border-color: var(--color-primary);
                    transform: translateY(-2px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }

                .super-faction-header {
                    padding: 1.25rem;
                    background: rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    border-bottom: 1px solid var(--border-subtle);
                }
                .faction-icon {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--surface-base);
                    border-radius: 50%;
                    color: var(--color-primary);
                }
                .super-faction-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    color: var(--text-primary);
                    font-weight: 600;
                }

                .sectorial-list {
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    flex: 1;
                }

                .sectorial-btn {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: 100%;
                    padding: 0.75rem 1rem;
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 6px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: left;
                    font-size: 0.95rem;
                }
                .sectorial-btn:hover {
                    background: var(--surface-base);
                    color: var(--text-primary);
                    padding-left: 1.25rem;
                }
                .sectorial-btn.vanilla {
                    font-weight: 600;
                    color: var(--text-primary);
                    border-color: var(--border-subtle);
                    background: rgba(255,255,255,0.03);
                }
                .sectorial-btn.vanilla:hover {
                    border-color: var(--color-primary);
                    background: rgba(var(--color-primary-rgb), 0.1);
                }

                .tag-disc {
                    font-size: 0.7rem;
                    padding: 2px 6px;
                    background: #333;
                    border-radius: 4px;
                    color: #aaa;
                    text-transform: uppercase;
                }

                /* Creation Overlay */
                .creation-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.8);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    animation: fadeIn 0.2s ease-out;
                }
                .creation-modal {
                    background: var(--surface-elevated);
                    border: 1px solid var(--border-light);
                    border-radius: 16px;
                    width: 90%;
                    max-width: 500px;
                    overflow: hidden;
                    position: relative;
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .close-btn {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: 50%;
                }
                .close-btn:hover {
                    background: var(--surface-base);
                    color: var(--text-primary);
                }

                .modal-header {
                    padding: 2.5rem 2rem 1.5rem;
                    text-align: center;
                    background: linear-gradient(180deg, rgba(var(--color-primary-rgb), 0.1) 0%, transparent 100%);
                    border-bottom: 1px solid var(--border-subtle);
                }
                .modal-logo {
                    width: 80px;
                    height: 80px;
                    object-fit: contain;
                    margin-bottom: 1rem;
                    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3));
                }
                .modal-header h2 {
                    margin: 0;
                    font-size: 1.75rem;
                    color: var(--text-primary);
                }
                .modal-subtitle {
                    color: var(--color-primary);
                    text-transform: uppercase;
                    font-size: 0.875rem;
                    font-weight: 600;
                    letter-spacing: 1px;
                }

                .modal-body {
                    padding: 2rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 0.75rem;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .points-dropdown {
                    width: 100%;
                    padding: 0.875rem 1rem;
                    background: #1a222d;
                    border: 1px solid #334155;
                    border-radius: 8px;
                    color: #f1f5f9;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 1rem center;
                    transition: all 0.2s;
                }
                .points-dropdown:hover {
                    border-color: #3b82f6;
                }
                .points-dropdown:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
                }
                .points-dropdown option {
                    background: #1a222d;
                    color: #f1f5f9;
                    padding: 0.5rem;
                }

                .info-box {
                    display: flex;
                    gap: 0.75rem;
                    padding: 1rem;
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 8px;
                    color: #93c5fd;
                    font-size: 0.9rem;
                    align-items: flex-start;
                }
                .info-box p { margin: 0; line-height: 1.4; }

                .create-confirm-btn {
                    width: 100%;
                    padding: 1rem;
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    transition: all 0.2s;
                    margin-top: 0.5rem;
                }
                .create-confirm-btn:hover {
                    filter: brightness(1.1);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 15px rgba(var(--color-primary-rgb), 0.4);
                }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            `}</style>
        </div>
    );
}
