// List Builder Page - Main component
import { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useListStore } from '../stores/useListStore';
import { useModal } from '../context/ModalContext';
import {
    ListDashboard,
    ImportModal,
    FactionSelector,
    ListHeader
} from '../components/ListBuilder';
import { encodeArmyList, copyArmyCodeToClipboard, decodeArmyCode } from '../utils/armyCode';
import type { Unit } from '../types';
import './ListBuilderPage.css';

export function ListBuilderPage() {
    const db = useDatabase();
    const { currentList, createList, addUnit, resetList, updatePointsLimit, addCombatGroup } = useListStore();
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

            setShowImportModal(false);
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
            <FactionSelector
                groupedFactions={groupedFactions}
                onFactionClick={handleFactionClick}
                onImportClick={() => setShowImportModal(true)}
            />

            <ImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                importCode={importCode}
                setImportCode={setImportCode}
                importError={importError}
                onImport={handleImportCode}
            />
        </div>
    );
}
