// Presets Bar for quick weapon and armor selection
import { WEAPON_PRESETS, ARMOR_PRESETS, type WeaponPreset, type ArmorPreset } from './types';

interface PresetsBarProps {
    onApplyWeapon: (preset: WeaponPreset) => void;
    onApplyArmor: (preset: ArmorPreset) => void;
}

export const PresetsBar = ({ onApplyWeapon, onApplyArmor }: PresetsBarProps) => (
    <div className="presets-bar">
        <div className="preset-group">
            <span className="preset-label">Weapons:</span>
            {WEAPON_PRESETS.map(p => (
                <button
                    key={p.name}
                    className="preset-chip"
                    onClick={() => onApplyWeapon(p)}
                    title={`PS ${p.ps}, ${p.ammo}, B${p.burst}`}
                >
                    {p.name}
                </button>
            ))}
        </div>
        <div className="preset-group">
            <span className="preset-label">Armor:</span>
            {ARMOR_PRESETS.map(p => (
                <button
                    key={p.name}
                    className="preset-chip armor-chip"
                    onClick={() => onApplyArmor(p)}
                    title={`ARM ${p.armor}`}
                >
                    {p.name}
                </button>
            ))}
        </div>
    </div>
);
