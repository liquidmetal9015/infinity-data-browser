import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Plus, X, Check, Info, Calculator } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';
import { useListBuilderUIStore } from '../../stores/useListBuilderUIStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import type { Fireteam, FireteamUnit, FireteamChart } from '@shared/types';
import { getFireteamBonuses, getUnitTags, calculateFireteamLevel, getMemberWithChartData } from '@shared/fireteams';
import styles from './FireteamsPage.module.css';

interface FireteamBuilderProps {
    chart: FireteamChart;
    factionId?: number;
}

export function FireteamBuilder({ chart, factionId }: FireteamBuilderProps) {
    const db = useDatabase();
    const selectUnitForDetail = useListBuilderUIStore(s => s.selectUnitForDetail);
    const openWindow = useWorkspaceStore(s => s.openWindow);
    const [selectedTeam, setSelectedTeam] = useState<Fireteam | null>(null);
    const [teamMembers, setTeamMembers] = useState<FireteamUnit[]>([]);

    // Determine max team size based on team type
    const maxTeamSize = useMemo(() => {
        if (!selectedTeam) return 0;
        if (selectedTeam.type.includes('CORE')) return 5;
        if (selectedTeam.type.includes('HARIS')) return 3;
        if (selectedTeam.type.includes('DUO')) return 2;
        return 5;
    }, [selectedTeam]);

    // Get wildcards
    const wildcards = useMemo(() => {
        const wTeam = chart.teams.find((t: Fireteam) => t.name.toLowerCase().includes('wildcard'));
        return wTeam ? wTeam.units : [];
    }, [chart]);

    const regularTeams = useMemo(() => {
        return chart.teams.filter((t: Fireteam) => !t.name.toLowerCase().includes('wildcard'));
    }, [chart]);

    const handleSelectTeam = (team: Fireteam) => {
        setSelectedTeam(team);
        setTeamMembers([]); // Reset members
    };

    const handleAddMember = (unit: FireteamUnit) => {
        if (teamMembers.length >= maxTeamSize) return;
        setTeamMembers([...teamMembers, unit]);
    };

    const handleRemoveMember = (idx: number) => {
        const newMembers = [...teamMembers];
        newMembers.splice(idx, 1);
        setTeamMembers(newMembers);
    };

    const mappedTeamMembers = useMemo(() => {
        return teamMembers.map(u => getMemberWithChartData(chart, u.name, u.slug));
    }, [teamMembers, chart]);

    // Calculate Bonuses
    const bonuses = useMemo(() => {
        if (!selectedTeam) return [];
        return getFireteamBonuses(selectedTeam, mappedTeamMembers);
    }, [selectedTeam, mappedTeamMembers]);

    return (
        <div className={styles.builderContainer}>
            {/* Left Column: Selection */}
            <div className={styles.builderSelection}>
                <h3>1. Select Team Type</h3>
                <div className={styles.teamSelector}>
                    {regularTeams.map((team: Fireteam, idx: number) => (
                        <button
                            key={idx}
                            className={clsx(styles.teamSelectBtn, selectedTeam?.name === team.name && styles.selected)}
                            onClick={() => handleSelectTeam(team)}
                        >
                            {team.name}
                        </button>
                    ))}
                </div>

                {selectedTeam && (
                    <>
                        <h3 style={{ marginTop: '1.5rem' }}>2. Add Units</h3>
                        {(() => {
                            // --- DYNAMIC VALIDATION LOGIC ---
                            const members = teamMembers;

                            // 1. Calculate Missing Requirements
                            const memberCounts = new Map<string, number>();
                            members.forEach(m => {
                                const name = m.name.toLowerCase();
                                memberCounts.set(name, (memberCounts.get(name) || 0) + 1);
                            });

                            let missingRequirements = false;

                            // Check A: Individual Minimums
                            selectedTeam.units.forEach(u => {
                                if (u.min > 0) {
                                    const current = memberCounts.get(u.name.toLowerCase()) || 0;
                                    if (current < u.min) missingRequirements = true;
                                }
                            });

                            // Check B: Group Requirement (*)
                            const requiredGroup = selectedTeam.units.filter(u => u.required);
                            let groupRequirementMet = false;
                            if (requiredGroup.length > 0) {
                                for (const reqUnit of requiredGroup) {
                                    if ((memberCounts.get(reqUnit.name.toLowerCase()) || 0) > 0) {
                                        groupRequirementMet = true;
                                        break;
                                    }
                                }
                                if (!groupRequirementMet) missingRequirements = true;
                            } else {
                                // No group requirement exists, so it's "met" by default
                                groupRequirementMet = true;
                            }

                            // HELPER: Does this unit help satisfy a CURRENTLY MISSING requirement?
                            const helpsRequirement = (u: FireteamUnit) => {
                                const name = u.name.toLowerCase();

                                // 1. Helps Individual Min?
                                const def = selectedTeam.units.find(d => d.name.toLowerCase() === name);
                                if (def && def.min > 0) {
                                    const current = memberCounts.get(name) || 0;
                                    if (current < def.min) return true;
                                }

                                // 2. Helps Group Requirement?
                                // Only relevant if the group requirement is NOT yet met.
                                if (!groupRequirementMet && u.required) {
                                    return true;
                                }

                                return false;
                            };

                            // LOGIC:
                            // If there are missing requirements, ONLY allow units that help satisfy them.
                            // If all requirements are met, allow anything (up to max size).
                            const strictMode = missingRequirements;

                            // Helper to check if unit raises level
                            const currentLevel = calculateFireteamLevel(selectedTeam, mappedTeamMembers);
                            const simulatesLevelUp = (u: FireteamUnit) => {
                                const mappedU = getMemberWithChartData(chart, u.name, u.slug);
                                const newLevel = calculateFireteamLevel(selectedTeam, [...mappedTeamMembers, mappedU]);
                                return newLevel > currentLevel;
                            };

                            const renderPoolItem = (u: FireteamUnit, idx: number, type: 'member' | 'wildcard') => {
                                const isRequiredHelper = helpsRequirement(u);
                                const isLevelUp = simulatesLevelUp(u);

                                let isDisabled = false;
                                if (teamMembers.length >= maxTeamSize) {
                                    isDisabled = true;
                                } else if (strictMode) {
                                    // In strict mode, MUST help with a requirement
                                    if (!isRequiredHelper) isDisabled = true;
                                }

                                const countsAs = getUnitTags(u.name, u.comment);
                                const countsAsStr = countsAs.filter(c => c !== u.name.toLowerCase()).join(', ');

                                return (
                                    <button
                                        key={`${type} -${idx} `}
                                        className={clsx(styles.poolItem, isLevelUp && styles.levelUp, isRequiredHelper && styles.requiredGlow)}
                                        onClick={() => handleAddMember(u)}
                                        disabled={isDisabled}
                                        style={isDisabled ? { opacity: 0.3, filter: 'grayscale(100%)' } : {}}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {u.name}
                                                {countsAsStr && <span className={styles.countsAsTiny}>({countsAsStr})</span>}
                                            </span>
                                            {/* Clean visuals: removed text tags */}
                                        </div>
                                        <Plus size={16} />
                                    </button>
                                );
                            };

                            return (
                                <div className={styles.unitPool}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Team Members</div>
                                    {selectedTeam.units.map((u: FireteamUnit, i: number) => renderPoolItem(u, i, 'member'))}

                                    {wildcards.length > 0 && (
                                        <>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Wildcards</div>
                                            {wildcards.map((u: FireteamUnit, i: number) => renderPoolItem(u, i, 'wildcard'))}
                                        </>
                                    )}
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>

            {/* Right Column: Workspace */}
            <div className={styles.builderWorkspace}>
                {!selectedTeam ? (
                    <div className={styles.emptyState} style={{ height: '100%' }}>
                        <Calculator size={48} className="text-secondary" />
                        <p>Select a Fireteam from the left to start building.</p>
                    </div>
                ) : (
                    <>
                        <div className={styles.activeTeamCard}>
                            <div className={styles.cardHeader} style={{ marginBottom: '1.5rem', background: 'transparent', borderBottom: 'none', padding: 0 }}>
                                <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{selectedTeam.name} Composition</h3>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {selectedTeam.type.map(t => (
                                        <span key={t} className={clsx(styles.badge, styles[t.toLowerCase() as keyof typeof styles])}>{t}</span>
                                    ))}
                                    <span style={{ marginLeft: 'auto', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Max Size: {maxTeamSize}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.teamSlots}>
                                {Array.from({ length: 5 }).map((_, idx) => {
                                    const member = teamMembers[idx];
                                    const isLocked = idx >= maxTeamSize;

                                    if (isLocked) {
                                        return (
                                            <div key={idx} className={clsx(styles.memberSlot, styles.locked)}>
                                                {/* Locked Slot */}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={idx} className={clsx(styles.memberSlot, member ? styles.filled : styles.empty)}>
                                            {member ? (
                                                <>
                                                    <div className={styles.slotContent}>
                                                        <div style={{ fontWeight: 'bold' }}>{member.name}</div>
                                                        {(() => {
                                                            const tags = getUnitTags(member.name, member.comment || '');
                                                            // Filter out the unit's own name (case insensitive)
                                                            const countsAsTag = tags.find(t => t.toLowerCase() !== member.name.toLowerCase());

                                                            if (countsAsTag) {
                                                                return (
                                                                    <div style={{ fontSize: '0.8rem', opacity: 0.7, fontStyle: 'italic' }}>
                                                                        ({countsAsTag})
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                        <button
                                                            className={styles.infoBtn}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const fullUnit = db.getUnitBySlug(member.slug);
                                                                if (fullUnit) { selectUnitForDetail(fullUnit, null, null, factionId ?? null); openWindow('UNIT_DETAIL'); }
                                                            }}
                                                            style={{ marginTop: '0.25rem' }}
                                                            title="View Unit Stats"
                                                        >
                                                            <Info size={16} /> Profile
                                                        </button>
                                                    </div>
                                                    <button
                                                        className={styles.removeBtn}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveMember(idx);
                                                        }}
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className={styles.slotContent} style={{ opacity: 0.3 }}>
                                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                                                        {idx + 1}
                                                    </div>
                                                    <span>Empty Slot</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={styles.bonusPanel}>
                                <h4>Active Bonuses</h4>
                                <div className={styles.bonusList}>
                                    {bonuses.map((bonus, idx) => (
                                        <div key={idx} className={clsx(styles.bonusItem, bonus.isActive && styles.active)}>
                                            <div className={styles.bonusCheck}>
                                                {bonus.isActive ? <Check size={14} /> : <span style={{ fontSize: '10px' }}>{bonus.level}</span>}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <strong>Level {bonus.level}: </strong>
                                                <span>{bonus.description}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
