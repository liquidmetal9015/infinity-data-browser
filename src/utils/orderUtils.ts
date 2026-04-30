import type { Profile } from '../../shared/types';
import type { Loadout as Option } from '../../shared/game-model';

export type OrderType = 'regular' | 'irregular' | 'impetuous' | 'lieutenant' | 'tactical-awareness';

// Maps the order type strings from the army data to our internal OrderType
const ORDER_TYPE_MAP: Record<string, OrderType> = {
    'REGULAR': 'regular',
    'IRREGULAR': 'irregular',
    'IMPETUOUS': 'impetuous',
    'LIEUTENANT': 'lieutenant',
    'TACTICAL': 'tactical-awareness',
};

/**
 * Extracts the order types a profile/option provides from the option's orders array.
 */
export function getProfileOrders(_profile?: Profile, option?: Option): OrderType[] {
    if (!option?.orders?.length) return [];

    const orders: OrderType[] = [];

    for (const order of option.orders) {
        const mapped = ORDER_TYPE_MAP[order.type];
        if (mapped) {
            orders.push(mapped);
        }
    }

    // If no regular/irregular order was found, default to regular
    if (!orders.includes('regular') && !orders.includes('irregular')) {
        orders.unshift('regular');
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
