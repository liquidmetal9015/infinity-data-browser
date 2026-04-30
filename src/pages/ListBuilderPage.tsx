// List Builder Page - Main component
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
import { calculateListPoints, calculateListSWC } from '@shared/listTypes';
import { useAuth } from '../hooks/useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
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

    const handleCreateList = () => {
        if (!globalFactionId) return;
        const factionName = db.getFactionName(globalFactionId);
        createList(globalFactionId, factionName, 300);
    };

    const saveListMutation = useMutation({
        mutationFn: async () => {
            if (!currentList) return null;
            const body = {
                name: currentList.name,
                description: currentList.description,
                tags: currentList.tags ?? [],
                faction_id: currentList.factionId,
                points: calculateListPoints(currentList),
                swc: calculateListSWC(currentList),
                units_json: currentList as Record<string, unknown>,
            };
            if (currentList.serverId) {
                const { data, error } = await api.PUT('/api/lists/{list_id}', {
                    params: { path: { list_id: currentList.serverId } },
                    body,
                });
                if (error) throw error;
                return data;
            } else {
                const { data, error } = await api.POST('/api/lists', { body });
                if (error) throw error;
                return data;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['my-lists'] });
            if (data && !currentList?.serverId) {
                setServerId(data.id);
            }
        },
        onError: (e) => {
            console.error("Save error", e);
        }
    });

    const handleSaveList = user ? () => saveListMutation.mutate() : undefined;
    const isSaved = saveListMutation.isSuccess && !saveListMutation.isPending;

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
                    onPointsLimitChange={updatePointsLimit}
                    onCopyCode={handleCopyCode}
                    onOpenInArmy={handleOpenInArmy}
                    onReset={resetList}
                    onSaveList={handleSaveList}
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
