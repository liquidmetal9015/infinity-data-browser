// Item-reference resolution shared by units and search routes.

export interface RawItem {
    id: number;
    modifiers?: string[];
}

export interface ItemRef {
    id: number;
    name: string;
    extra_display: string[];
}

export function resolveItems(
    items: unknown,
    catalog: Map<number, string>,
): ItemRef[] {
    if (!Array.isArray(items)) return [];
    return items.map((raw): ItemRef => {
        const item = raw as RawItem;
        const id = item.id ?? 0;
        return {
            id,
            name: catalog.get(id) ?? `Unknown (${id})`,
            extra_display: Array.isArray(item.modifiers) ? item.modifiers : [],
        };
    });
}

export function isVanilla(parentId: number | null, id: number): boolean {
    return parentId === null || parentId === id;
}
