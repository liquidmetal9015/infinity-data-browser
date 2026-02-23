import type { Profile, Option } from '../../shared/types';

export const ORDER_SKILLS = {
    REGULAR: 258,
    IMPETUOUS: 256,
    LIEUTENANT: 119,
    TACTICAL_AWARENESS: 213,
    NCO: 211,
};

export type OrderType = 'regular' | 'irregular' | 'impetuous' | 'lieutenant' | 'tactical-awareness';

/**
 * Extracts the explicit and implicit order types a profile/option provides.
 */
export function getProfileOrders(profile?: Profile, option?: Option): OrderType[] {
    const orders: OrderType[] = [];

    if (!profile || !option) return orders;

    // Combine skills from both base profile and specific option
    const allSkills = [...profile.skills, ...option.skills];

    const hasSkill = (id: number) => allSkills.some(s => s.id === id);

    // Regular / Irregular determination
    if (hasSkill(ORDER_SKILLS.REGULAR)) {
        orders.push('regular');
    } else {
        orders.push('irregular');
    }

    if (hasSkill(ORDER_SKILLS.IMPETUOUS)) {
        orders.push('impetuous');
    }

    if (hasSkill(ORDER_SKILLS.LIEUTENANT)) {
        orders.push('lieutenant');
    }

    if (hasSkill(ORDER_SKILLS.TACTICAL_AWARENESS)) {
        orders.push('tactical-awareness');
    }

    return orders;
}

/**
 * Aggregates the total counts of each order type in a combat group.
 */
export function countGroupOrders(units: { profile?: Profile, option?: Option }[]): Record<OrderType, number> {
    const counts: Record<OrderType, number> = {
        'regular': 0,
        'irregular': 0,
        'impetuous': 0,
        'lieutenant': 0,
        'tactical-awareness': 0
    };

    units.forEach(unit => {
        const orders = getProfileOrders(unit.profile, unit.option);
        orders.forEach(order => {
            counts[order]++;
        });
    });

    return counts;
}
