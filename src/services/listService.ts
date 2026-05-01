import type { ArmyList } from '@shared/listTypes';
import { generateId, calculateListPoints, calculateListSWC } from '@shared/listTypes';
import api from './api';
import type { components } from '../types/schema';

export interface ListSummary {
    id: string;
    name: string;
    faction_id: number;
    points: number;
    swc: number;
    unit_count: number;
    tags: string[];
    created_at: string;
    updated_at: string;
}

export interface IListService {
    getLists(): Promise<ListSummary[]>;
    getList(id: string): Promise<ArmyList>;
    createList(list: ArmyList, factionId: number): Promise<ListSummary>;
    updateList(id: string, patch: Partial<ArmyList>): Promise<ListSummary>;
    deleteList(id: string): Promise<void>;
    forkList(id: string, newName?: string): Promise<ListSummary>;
}

/**
 * Pure function — creates a forked copy of a list with a new id and no serverId.
 * Used both by the service implementations and by ListBuilderPage (which has the full list in hand).
 */
export function forkListLocally(original: ArmyList, newName?: string): ArmyList {
    return {
        ...original,
        id: generateId(),
        name: newName ?? `${original.name} (fork)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        serverId: undefined,
    };
}

// ── localStorage implementation ──────────────────────────────────────────

const LIBRARY_KEY = 'infinity-list-library';

function readLibrary(): ArmyList[] {
    try {
        return JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]');
    } catch {
        return [];
    }
}

function writeLibrary(lists: ArmyList[]): void {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(lists));
}

function toSummary(list: ArmyList): ListSummary {
    return {
        id: list.id,
        name: list.name,
        faction_id: list.factionId,
        points: calculateListPoints(list),
        swc: calculateListSWC(list),
        unit_count: list.groups.reduce(
            (total, g) => total + g.units.filter(u => !u.isPeripheral).length,
            0,
        ),
        tags: list.tags ?? [],
        created_at: new Date(list.createdAt).toISOString(),
        updated_at: new Date(list.updatedAt).toISOString(),
    };
}

export const localStorageListService: IListService = {
    getLists: async () => readLibrary().map(toSummary),

    getList: async (id) => {
        const list = readLibrary().find(l => l.id === id);
        if (!list) throw new Error(`List ${id} not found`);
        return list;
    },

    createList: async (list, factionId) => {
        const library = readLibrary();
        const existing = library.findIndex(l => l.id === list.id);
        const updated: ArmyList = { ...list, factionId, updatedAt: Date.now() };
        if (existing >= 0) {
            library[existing] = updated;
        } else {
            library.unshift(updated);
        }
        writeLibrary(library);
        return toSummary(updated);
    },

    updateList: async (id, patch) => {
        const library = readLibrary();
        const idx = library.findIndex(l => l.id === id);
        if (idx < 0) throw new Error(`List ${id} not found`);
        const updated: ArmyList = { ...library[idx], ...patch, updatedAt: Date.now() };
        library[idx] = updated;
        writeLibrary(library);
        return toSummary(updated);
    },

    deleteList: async (id) => {
        writeLibrary(readLibrary().filter(l => l.id !== id));
    },

    forkList: async (id, newName) => {
        const original = readLibrary().find(l => l.id === id);
        if (!original) throw new Error(`List ${id} not found`);
        const forked = forkListLocally(original, newName);
        const library = readLibrary();
        library.unshift(forked);
        writeLibrary(library);
        return toSummary(forked);
    },
};

// ── API implementation ───────────────────────────────────────────────────

// The generated schema is missing tags/unit_count from summary responses — the backend returns them.
type ApiSummary = components["schemas"]["ArmyListSummaryResponse"] & {
    unit_count?: number;
    tags?: string[];
};

function fromApiSummary(s: ApiSummary): ListSummary {
    return {
        id: String(s.id),
        name: s.name,
        faction_id: s.faction_id,
        points: s.points,
        swc: s.swc,
        unit_count: s.unit_count ?? 0,
        tags: s.tags ?? [],
        created_at: s.created_at,
        updated_at: s.updated_at,
    };
}

export const apiListService: IListService = {
    getLists: async () => {
        const { data, error } = await api.GET('/api/lists');
        if (error) throw error;
        return (data ?? []).map(s => fromApiSummary(s as ApiSummary));
    },

    getList: async (id) => {
        const { data, error } = await api.GET('/api/lists/{list_id}', {
            params: { path: { list_id: Number(id) } },
        });
        if (error) throw error;
        const armyList = data.units_json as unknown as ArmyList;
        armyList.serverId = data.id;
        if (!armyList.tags) armyList.tags = [];
        return armyList;
    },

    createList: async (list, factionId) => {
        const { data, error } = await api.POST('/api/lists', {
            // Schema is outdated — backend also accepts description/tags
            body: {
                name: list.name,
                faction_id: factionId,
                points: calculateListPoints(list),
                swc: calculateListSWC(list),
                units_json: list as unknown as Record<string, unknown>,
            } as components["schemas"]["ArmyListCreate"],
        });
        if (error) throw error;
        return fromApiSummary(data as ApiSummary);
    },

    updateList: async (id, patch) => {
        // Build only the fields that are present in the patch
        const body: components["schemas"]["ArmyListUpdate"] = {};
        if (patch.name !== undefined) body.name = patch.name;
        if (patch.factionId !== undefined) body.faction_id = patch.factionId;
        if (patch.groups !== undefined) {
            const fullList = patch as ArmyList;
            body.units_json = fullList as unknown as Record<string, unknown>;
            body.points = calculateListPoints(fullList);
            body.swc = calculateListSWC(fullList);
        }
        // tags is not in the schema but the backend supports it
        const bodyWithTags = patch.tags !== undefined
            ? { ...body, tags: patch.tags }
            : body;
        const { data, error } = await api.PUT('/api/lists/{list_id}', {
            params: { path: { list_id: Number(id) } },
            body: bodyWithTags as components["schemas"]["ArmyListUpdate"],
        });
        if (error) throw error;
        return fromApiSummary(data as unknown as ApiSummary);
    },

    deleteList: async (id) => {
        const { error } = await api.DELETE('/api/lists/{list_id}', {
            params: { path: { list_id: Number(id) } },
        });
        if (error) throw error;
    },

    forkList: async (id, newName) => {
        const original = await apiListService.getList(id);
        const forked = forkListLocally(original, newName);
        return apiListService.createList(forked, forked.factionId);
    },
};

// ── Mode selection ───────────────────────────────────────────────────────

export const STATIC_MODE = import.meta.env.VITE_DEPLOY_MODE === 'static';

export const listService: IListService = STATIC_MODE
    ? localStorageListService
    : apiListService;
