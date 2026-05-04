import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, FolderOpen } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';
import { useListStore } from '../../stores/useListStore';
import { useGlobalFactionStore } from '../../stores/useGlobalFactionStore';
import { useArmyListImportExport } from '../../hooks/useArmyListImportExport';
import { NewListModal } from '../ListBuilder/NewListModal';

const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    borderRadius: '10px',
    border: '1px solid var(--border-hover)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 'var(--text-md)',
    fontWeight: 'var(--font-semibold)',
    textAlign: 'left',
    width: '100%',
    transition: 'background 0.15s, border-color 0.15s',
};

function ActionCard({ icon, label, description, onClick }: {
    icon: React.ReactNode;
    label: string;
    description: string;
    onClick: () => void;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                ...cardStyle,
                background: hovered ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                borderColor: hovered ? 'var(--color-primary)' : 'var(--border-hover)',
            }}
        >
            {icon}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>{label}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 400 }}>{description}</span>
            </div>
        </button>
    );
}

export function NoActiveListView() {
    const db = useDatabase();
    const navigate = useNavigate();
    const [showNewModal, setShowNewModal] = useState(false);

    const currentList = useListStore(s => s.currentList);
    const createList = useListStore(s => s.createList);
    const addCombatGroup = useListStore(s => s.addCombatGroup);
    const addUnit = useListStore(s => s.addUnit);
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();

    const { importCode, importError, setImportCode, handleImportCode } = useArmyListImportExport({
        db, currentList, createList, setGlobalFactionId, addCombatGroup, addUnit,
    });

    const handleCreate = (name: string, factionId: number, points: number) => {
        const factionName = db.getFactionName(factionId);
        createList(factionId, factionName, points, name);
        setShowNewModal(false);
    };

    return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', overflowY: 'auto' }}>
            <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontFamily: "'Oxanium', sans-serif", fontSize: '1.4rem', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                        No active list
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-md)', margin: 0 }}>
                        Open one of your saved lists, create a new one, or import an army code.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <ActionCard
                        icon={<FilePlus2 size={20} />}
                        label="Create new list"
                        description="Pick a faction and start building. You can also paste an army code from this dialog."
                        onClick={() => setShowNewModal(true)}
                    />
                    <ActionCard
                        icon={<FolderOpen size={20} />}
                        label="Open from My Lists"
                        description="Browse and load a list you've already saved."
                        onClick={() => navigate('/lists')}
                    />
                </div>
            </div>

            {showNewModal && (
                <NewListModal
                    db={db}
                    globalFactionId={globalFactionId}
                    setGlobalFactionId={setGlobalFactionId}
                    onConfirm={handleCreate}
                    onCancel={() => setShowNewModal(false)}
                    importCode={importCode}
                    importError={importError}
                    onImportCodeChange={setImportCode}
                    onImportCode={handleImportCode}
                />
            )}
        </div>
    );
}
