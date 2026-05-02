import { useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { useListStore } from '../stores/useListStore';
import { useGlobalFactionStore } from '../stores/useGlobalFactionStore';
import { useModal } from '../hooks/useModal';
import {
    ListDashboard,
    ListHeader,
    NewListModal,
} from '../components/ListBuilder';
import { useArmyListImportExport } from '../hooks/useArmyListImportExport';
import { useAuth } from '../hooks/useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { listService, forkListLocally, STATIC_MODE } from '../services/listService';
import type { Unit } from '@shared/types';
import styles from './ListBuilderPage.module.css';

export function ListBuilderPage() {
    const db = useDatabase();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { currentList, createList, addUnit, resetList, updatePointsLimit, addCombatGroup, setServerId } = useListStore();
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();
    const { openUnitModal } = useModal();

    const {
        codeCopied,
        importCode,
        importError,
        setImportCode,
        handleImportCode,
        handleCopyCode,
        handleOpenInArmy,
    } = useArmyListImportExport({ db, currentList, createList, setGlobalFactionId, addCombatGroup, addUnit });

    const [savedAt, setSavedAt] = useState<number | null>(null);

    const saveListMutation = useMutation({
        mutationFn: async () => {
            if (!currentList) return null;
            if (!STATIC_MODE && currentList.serverId) {
                return listService.updateList(String(currentList.serverId), currentList);
            }
            return listService.createList(currentList, currentList.factionId);
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['my-lists'] });
            if (data && !STATIC_MODE && !currentList?.serverId) {
                setServerId(Number(data.id));
            }
            setSavedAt(currentList?.updatedAt ?? null);
        },
        onError: (e) => {
            console.error("Save error", e);
        }
    });

    const forkListMutation = useMutation({
        mutationFn: async () => {
            if (!currentList) return null;
            const forked = forkListLocally(currentList);
            return listService.createList(forked, currentList.factionId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-lists'] });
        },
        onError: (e) => {
            console.error("Fork error", e);
        }
    });

    const canSave = STATIC_MODE || !!user;
    const handleSaveList = canSave ? () => saveListMutation.mutate() : undefined;
    const handleSaveAsCopy = canSave ? () => forkListMutation.mutate() : undefined;
    const isSaved = saveListMutation.isSuccess && !saveListMutation.isPending;
    const hasUnsavedChanges = !!currentList && (
        savedAt === null
            ? !!currentList.serverId
            : currentList.updatedAt > savedAt
    );

    if (currentList) {
        return (
            <div className={styles.listBuilderPage}>
                <ListHeader
                    list={currentList}
                    factionName={db.getFactionName(currentList.factionId)}
                    codeCopied={codeCopied}
                    isSaving={saveListMutation.status === 'pending'}
                    isSaved={isSaved}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onPointsLimitChange={updatePointsLimit}
                    onCopyCode={handleCopyCode}
                    onOpenInArmy={handleOpenInArmy}
                    onReset={resetList}
                    onSaveList={handleSaveList}
                    onSaveAsCopy={handleSaveAsCopy}
                />

                {hasUnsavedChanges && !saveListMutation.isPending && handleSaveList && (
                    <div className={styles.unsavedBanner}>
                        <span>You have unsaved changes</span>
                        <button className={styles.unsavedBannerSave} onClick={handleSaveList}>
                            Save List
                        </button>
                    </div>
                )}

                <ListDashboard
                    list={currentList}
                    onViewUnit={(unit: Unit) => {
                        openUnitModal(unit);
                    }}
                />
            </div>
        );
    }

    return (
        <NewListModal
            db={db}
            globalFactionId={globalFactionId}
            setGlobalFactionId={setGlobalFactionId}
            onConfirm={(name, factionId, points) => {
                const factionName = db.getFactionName(factionId);
                createList(factionId, factionName, points, name);
            }}
            importCode={importCode}
            importError={importError}
            onImportCodeChange={setImportCode}
            onImportCode={handleImportCode}
        />
    );
}
