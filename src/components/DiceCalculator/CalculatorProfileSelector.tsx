import { useMemo } from 'react';
import type { Unit, Profile, Option } from '../../../shared/types';
import './CalculatorProfileSelector.css';

export interface ExtendedProfile extends Profile {
    optionId: number;
    optionName: string;
}

interface CalculatorProfileSelectorProps {
    unit: Unit;
    selectedProfileId?: number;
    onSelect: (profile: Profile, option: Option) => void;
}

export function CalculatorProfileSelector({ unit, selectedProfileId, onSelect }: CalculatorProfileSelectorProps) {

    // Flatten all profiles from all options so they can be selected in a single dropdown
    const availableProfiles = useMemo(() => {
        const flat: { profile: Profile, option: Option }[] = [];

        unit.raw.profileGroups.forEach(group => {
            group.options.forEach(option => {
                group.profiles.forEach(profile => {
                    flat.push({ profile, option });
                });
            });
        });

        return flat;
    }, [unit]);

    return (
        <div className="calculator-profile-selector">
            <select
                className="profile-select"
                value={selectedProfileId || ''}
                onChange={(e) => {
                    const idx = parseInt(e.target.value);
                    if (!isNaN(idx) && availableProfiles[idx]) {
                        onSelect(availableProfiles[idx].profile, availableProfiles[idx].option);
                    }
                }}
            >
                <option value="" disabled>Select Loadout Profile...</option>
                {availableProfiles.map((item, index) => (
                    <option key={`${item.profile.id}-${item.option.id}-${index}`} value={index}>
                        {item.profile.name !== unit.raw.isc ? `${item.profile.name} - ` : ''}{item.option.name}
                    </option>
                ))}
            </select>
        </div>
    );
}
