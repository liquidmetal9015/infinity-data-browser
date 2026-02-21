// Ammo Toggle Chips
import { AMMO_LIST } from './types';

interface AmmoSelectorProps {
    ammo: string;
    ap: boolean;
    continuous: boolean;
    critImmune: boolean;
    cover?: boolean;
    onUpdate: (field: string, val: any) => void;
}

export const AmmoSelector = ({ ammo, ap, continuous, critImmune, cover, onUpdate }: AmmoSelectorProps) => (
    <div className="ammo-selector">
        <div className="ammo-row">
            {AMMO_LIST.map(a => (
                <button
                    key={a}
                    className={`ammo-btn ${ammo === a ? 'active' : ''}`}
                    onClick={() => onUpdate('ammo', a)}
                >
                    {a}
                </button>
            ))}
        </div>
        <div className="ammo-toggles">
            <button
                className={`toggle-btn ${ap ? 'active' : ''}`}
                onClick={() => onUpdate('ap', !ap)}
            >
                AP
            </button>
            <button
                className={`toggle-btn ${continuous ? 'active' : ''}`}
                onClick={() => onUpdate('continuous', !continuous)}
            >
                CONT
            </button>
            <button
                className={`toggle-btn ${critImmune ? 'active' : ''}`}
                onClick={() => onUpdate('critImmune', !critImmune)}
            >
                CRIT IMMUNE
            </button>
            {cover !== undefined && (
                <button
                    className={`toggle-btn ${cover ? 'active' : ''}`}
                    onClick={() => onUpdate('cover', !cover)}
                >
                    COVER
                </button>
            )}
        </div>
    </div>
);
