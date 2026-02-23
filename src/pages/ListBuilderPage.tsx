// List Builder Page - Main component
import { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useListStore } from '../stores/useListStore';
import { useGlobalFactionStore } from '../stores/useGlobalFactionStore';
import { useModal } from '../context/ModalContext';
import {
    ListDashboard,
    ListHeader
} from '../components/ListBuilder';
import { CompactFactionSelector } from '../components/shared/CompactFactionSelector';
import { encodeArmyList, copyArmyCodeToClipboard, decodeArmyCode } from '../utils/armyCode';
import type { Unit } from '../types';
import './ListBuilderPage.css';

export function ListBuilderPage() {
    const db = useDatabase();
    const { currentList, createList, addUnit, resetList, updatePointsLimit, addCombatGroup } = useListStore();
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();
    const { openUnitModal } = useModal();
    const [codeCopied, setCodeCopied] = useState(false);
    const [importCode, setImportCode] = useState('');
    const [importError, setImportError] = useState('');

    const groupedFactions = db.getGroupedFactions();

    const handleCreateList = () => {
        if (!globalFactionId) return;
        const factionName = db.getFactionName(globalFactionId);
        createList(globalFactionId, factionName, 300);
    };

    const handleImportCode = () => {
        setImportError('');

        try {
            const decoded = decodeArmyCode(importCode.trim());

            // Create the list with decoded faction, points and name
            createList(decoded.factionId, decoded.factionSlug || 'Unknown', decoded.maxPoints, decoded.armyName);
            setGlobalFactionId(decoded.factionId);

            // For each combat group and member, find the unit and add it
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
                            member.groupChoice,
                            member.optionChoice
                        );
                    }
                });
            });

            setImportCode('');
        } catch (error) {
            console.error('Import error:', error);
            setImportError('Invalid army code format. Please check and try again.');
        }
    };

    const handleCopyCode = async () => {
        if (!currentList) return;

        // Get faction info to get the slug (official format uses slug)
        const faction = db.getFactionInfo(currentList.factionId);
        const factionSlug = faction?.slug || 'unknown';

        const code = encodeArmyList(
            currentList,
            factionSlug,
            (unit) => unit.idArmy || unit.id
        );

        await copyArmyCodeToClipboard(code);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };

    // If a list exists, show the Dashboard
    if (currentList) {
        return (
            <div className="list-builder-page">
                <ListHeader
                    list={currentList}
                    factionName={db.getFactionName(currentList.factionId)}
                    codeCopied={codeCopied}
                    onPointsLimitChange={updatePointsLimit}
                    onCopyCode={handleCopyCode}
                    onReset={resetList}
                />

                <ListDashboard
                    list={currentList}
                    onViewUnit={(unit: Unit) => {
                        openUnitModal(unit);
                    }}
                />
            </div>
        );
    }

    // Faction Selection View
    return (
        <div className="list-builder-page">
            <div className="empty-state-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '4rem', paddingBottom: '4rem', height: '100%', minHeight: '50vh', gap: '2rem', maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>

                {/* Create New Block */}
                <div style={{ width: '100%', padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Create New Army List</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Select a faction to start building a new roster manually.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'stretch' }}>
                        <div style={{ flex: 1 }}>
                            <CompactFactionSelector
                                groupedFactions={groupedFactions}
                                value={globalFactionId}
                                onChange={setGlobalFactionId}
                            />
                        </div>
                        <button
                            className="px-8 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-lg flex items-center justify-center whitespace-nowrap"
                            onClick={handleCreateList}
                            disabled={!globalFactionId}
                        >
                            Create List
                        </button>
                    </div>
                </div>

                {/* OR Divider */}
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '1rem' }}>
                    <hr style={{ flex: 1, borderColor: 'var(--border-color)', borderTop: 'none' }} />
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>OR</span>
                    <hr style={{ flex: 1, borderColor: 'var(--border-color)', borderTop: 'none' }} />
                </div>

                {/* Import Block */}
                <div style={{ width: '100%', padding: '2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Import Existing List</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Paste an army code from the official Infinity builder or another source.</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                        <textarea
                            value={importCode}
                            onChange={e => setImportCode(e.target.value)}
                            placeholder="Paste army code here..."
                            rows={3}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'none' }}
                        />
                        {importError && <div style={{ color: 'var(--error-color)', fontSize: '0.9rem', textAlign: 'center' }}>{importError}</div>}
                        <button
                            className="px-8 py-4 bg-[#18181b] hover:bg-[#1f1f23] border border-[#ffffff14] text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-lg w-full flex items-center justify-center whitespace-nowrap mt-4"
                            onClick={handleImportCode}
                            disabled={!importCode.trim()}
                        >
                            Import Code
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
