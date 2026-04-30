import { useMemo } from 'react';
import { getClassifiedsForOption, type ClassifiedMatch } from '../../shared/classifieds';
import type { Unit, Profile } from '../../shared/types';
import type { Loadout } from '../../shared/game-model';
import type { IDatabase } from '../services/Database';

interface ClassifiedMatchEntry {
    unit: Unit;
    completableClassifieds: Set<number>;
    profileMatches: {
        profile: Profile;
        option: Loadout;
        matches: ClassifiedMatch[];
    }[];
}

export function useClassifiedMatches(
    db: IDatabase,
    factionUnits: Unit[]
): Map<string, ClassifiedMatchEntry> | null {
    return useMemo(() => {
        if (!db.classifieds.length) return null;

        const matches = new Map<string, ClassifiedMatchEntry>();

        factionUnits.forEach(unit => {
            const unitEntry: ClassifiedMatchEntry = {
                unit,
                completableClassifieds: new Set<number>(),
                profileMatches: [],
            };

            unit.raw.profileGroups.forEach(pg => {
                pg.profiles.forEach(profile => {
                    pg.options.forEach(option => {
                        const optionMatches = getClassifiedsForOption(
                            unit,
                            profile,
                            option,
                            db.classifieds,
                        );

                        const validMatches = optionMatches.filter(m => m.canComplete);
                        if (validMatches.length > 0) {
                            validMatches.forEach(m => unitEntry.completableClassifieds.add(m.objectiveId));
                            unitEntry.profileMatches.push({ profile, option, matches: validMatches });
                        }
                    });
                });
            });

            if (unitEntry.completableClassifieds.size > 0) {
                matches.set(unit.isc, unitEntry);
            }
        });

        return matches;
    }, [db.classifieds, factionUnits]);
}
