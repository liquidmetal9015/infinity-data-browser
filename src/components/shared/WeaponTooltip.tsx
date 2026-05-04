import { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { ExternalLink } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';
import { RANGE_BANDS } from '@shared/weapon-utils';

const TEMPLATE_LENGTHS = { small: 8.4, large: 10.2 };

function getRangeModifier(bands: { start: number; end: number; mod: number }[], samplePoint: number): number | null {
    const band = bands.find(b => b.start < samplePoint && b.end >= samplePoint);
    return band ? band.mod : null;
}

function RangeCellStyle(mod: number | null, isTemplate: boolean, templateCovers: boolean): React.CSSProperties {
    if (isTemplate) {
        return templateCovers
            ? { background: 'rgba(234, 179, 8, 0.2)', color: '#eab308', fontWeight: 'var(--font-bold)' }
            : { background: 'rgba(255,255,255,0.03)', color: '#334155' };
    }
    if (mod === null) return { background: 'rgba(255,255,255,0.03)', color: '#334155' };
    if (mod > 0) return { background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)', fontWeight: 'var(--font-bold)' };
    if (mod < 0) return { background: 'rgba(239, 68, 68, 0.15)', color: 'var(--error)', fontWeight: 'var(--font-semibold)' };
    return { background: 'rgba(255,255,255,0.06)', color: '#94a3b8' };
}

interface TooltipPosition { x: number; y: number }

function WeaponCard({ weaponId, pos }: { weaponId: number; pos: TooltipPosition }) {
    const db = useDatabase();
    const weapon = useMemo(() => db?.getWeaponDetails(weaponId), [db, weaponId]);
    const wikiUrl = useMemo(() => db?.metadata?.weapons?.find(w => w.id === weaponId)?.wiki, [db, weaponId]);

    if (!weapon) return null;

    const isTemplate = weapon.templateType === 'small' || weapon.templateType === 'large';
    const templateLen = isTemplate ? TEMPLATE_LENGTHS[weapon.templateType as 'small' | 'large'] : 0;

    // Viewport-aware positioning
    const cardWidth = 320;
    const cardHeight = 160;
    let x = pos.x + 15;
    let y = pos.y + 15;
    if (x + cardWidth > window.innerWidth - 8) x = pos.x - cardWidth - 8;
    if (y + cardHeight > window.innerHeight - 8) y = pos.y - cardHeight - 8;

    return ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                left: x,
                top: y,
                zIndex: 9999,
                width: cardWidth,
                background: '#0f1929',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 10,
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                pointerEvents: 'none',
                fontFamily: 'inherit',
            }}
        >
            {/* Header */}
            <div style={{
                padding: 'var(--space-2) var(--space-3) var(--space-1)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
            }}>
                <span style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-sm)', color: '#e2e8f0' }}>{weapon.name}</span>
                {wikiUrl && (
                    <a
                        href={wikiUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)', flexShrink: 0, pointerEvents: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink size={12} />
                    </a>
                )}
            </div>

            {/* Stats row */}
            <div style={{
                padding: 'var(--space-1) var(--space-3)',
                display: 'flex',
                gap: 'var(--space-4)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
                {[
                    { label: 'B', value: weapon.burst },
                    { label: 'DAM', value: weapon.damage },
                    { label: 'AMMO', value: weapon.ammunition },
                    { label: 'SAVE', value: weapon.saving + (weapon.savingNum && weapon.savingNum !== '-' && weapon.savingNum !== '1' ? `/${weapon.savingNum}` : '') },
                ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <span style={{ fontSize: 'var(--text-2xs)', color: '#475569', fontWeight: 'var(--font-semibold)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: '#cbd5e1', fontWeight: 'var(--font-semibold)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                    </div>
                ))}
            </div>

            {/* Range strip */}
            <div style={{ padding: 'var(--space-1) var(--space-3)' }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                    {RANGE_BANDS.slice(0, 7).map((band, idx) => {
                        const samplePoint = band.start + 1;
                        const mod = getRangeModifier(weapon.bands, samplePoint);
                        const templateCovers = isTemplate && band.start < templateLen;
                        const cellStyle = RangeCellStyle(mod, isTemplate, templateCovers);
                        const label = isTemplate
                            ? (templateCovers ? 'DT' : '-')
                            : (mod === null ? '-' : mod > 0 ? `+${mod}` : `${mod}`);

                        return (
                            <div
                                key={idx}
                                title={band.label}
                                style={{
                                    flex: 1,
                                    textAlign: 'center',
                                    fontSize: 'var(--text-2xs)',
                                    padding: '3px 0',
                                    borderRadius: 3,
                                    ...cellStyle,
                                }}
                            >
                                {label}
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                    {RANGE_BANDS.slice(0, 7).map((band) => (
                        <div key={band.label} style={{ flex: 1, textAlign: 'center', fontSize: 'var(--text-2xs)', color: '#334155' }}>
                            {band.label.replace('"', '')}
                        </div>
                    ))}
                </div>
            </div>

            {/* Properties */}
            {weapon.properties.length > 0 && (
                <div style={{
                    padding: '0 var(--space-3) var(--space-2)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-1)',
                }}>
                    {weapon.properties.map(p => (
                        <span key={p} style={{
                            fontSize: 'var(--text-2xs)',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(99,102,241,0.12)',
                            color: '#818cf8',
                        }}>{p}</span>
                    ))}
                </div>
            )}
        </div>,
        document.body
    );
}

export function WeaponTooltip({ weaponId, children }: { weaponId: number; children: React.ReactNode }) {
    const [pos, setPos] = useState<TooltipPosition | null>(null);

    return (
        <>
            <span
                style={{ cursor: 'help' }}
                onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setPos(null)}
    
            >
                {children}
            </span>
            {pos && <WeaponCard weaponId={weaponId} pos={pos} />}
        </>
    );
}
