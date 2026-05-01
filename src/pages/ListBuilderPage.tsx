// List Builder Page - Main component
import { useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { useListStore } from '../stores/useListStore';
import { useGlobalFactionStore } from '../stores/useGlobalFactionStore';
import { useModal } from '../hooks/useModal';
import {
    ListDashboard,
    ListHeader
} from '../components/ListBuilder';
import { CompactFactionSelector } from '../components/shared/CompactFactionSelector';
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

    const groupedFactions = db.getGroupedFactions();

    const {
        codeCopied,
        importCode,
        importError,
        setImportCode,
        handleImportCode,
        handleCopyCode,
        handleOpenInArmy,
    } = useArmyListImportExport({ db, currentList, createList, setGlobalFactionId, addCombatGroup, addUnit });

    // Track the updatedAt of the last successful save so we can show an unsaved-changes indicator
    const [savedAt, setSavedAt] = useState<number | null>(null);

    const handleCreateList = () => {
        if (!globalFactionId) return;
        const factionName = db.getFactionName(globalFactionId);
        createList(globalFactionId, factionName, 300);
    };

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
            // In GCP mode, after the first save, persist the server id so subsequent saves use PUT
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
            // We have the full list in hand — fork locally and create without a round-trip fetch
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
    // Show unsaved if the list has been modified since the last save
    const hasUnsavedChanges = !!currentList && (
        savedAt === null
            ? !!currentList.serverId  // already saved once (has serverId) but we haven't tracked it yet
            : currentList.updatedAt > savedAt
    );

    // If a list exists, show the Dashboard
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
        <div className={styles.listBuilderPage}>
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
