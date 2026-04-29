import { useState } from 'react';
import { encodeArmyList, decodeArmyCode } from '@shared/armyCode';
import { copyArmyCodeToClipboard } from '../utils/armyCode';
import type { IDatabase } from '../services/Database';
import type { ArmyList } from '@shared/listTypes';

interface UseArmyListImportExportArgs {
    db: IDatabase;
    currentList: ArmyList | null;
    createList: (factionId: number, factionName: string, maxPoints: number, armyName?: string) => void;
    setGlobalFactionId: (id: number) => void;
    addCombatGroup: () => void;
    addUnit: (unit: import('@shared/types').Unit, groupIndex: number, profileGroupId: number, profileId: number, optionId: number) => void;
}

export function useArmyListImportExport({
    db,
    currentList,
    createList,
    setGlobalFactionId,
    addCombatGroup,
    addUnit,
}: UseArmyListImportExportArgs) {
    const [codeCopied, setCodeCopied] = useState(false);
    const [importCode, setImportCode] = useState('');
    const [importError, setImportError] = useState('');

    const handleImportCode = () => {
        setImportError('');
        try {
            const decoded = decodeArmyCode(importCode.trim());
            createList(decoded.factionId, decoded.factionSlug || 'Unknown', decoded.maxPoints, decoded.armyName);
            setGlobalFactionId(decoded.factionId);

            decoded.combatGroups.forEach((group, index) => {
                if (index > 0) addCombatGroup();
                group.members.forEach(member => {
                    const unit = db.units.find(u => u.id === member.unitId || u.idArmy === member.unitId);
                    if (unit) {
                        addUnit(unit, index, member.groupChoice, member.groupChoice, member.optionChoice);
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
        const faction = db.getFactionInfo(currentList.factionId);
        const code = encodeArmyList(currentList, faction?.slug || 'unknown', (unit) => unit.idArmy || unit.id);
        await copyArmyCodeToClipboard(code);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };

    const handleOpenInArmy = () => {
        if (!currentList) return;
        const faction = db.getFactionInfo(currentList.factionId);
        const code = encodeArmyList(currentList, faction?.slug || 'unknown', (unit) => unit.idArmy || unit.id);
        window.open(`https://infinitytheuniverse.com/army/list/${code}`, '_blank');
    };

    return {
        codeCopied,
        importCode,
        importError,
        setImportCode,
        handleImportCode,
        handleCopyCode,
        handleOpenInArmy,
    };
}
