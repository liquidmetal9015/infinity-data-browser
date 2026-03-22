import { create } from 'zustand';
import { DatabaseImplementation, type IDatabase } from '../services/Database';

interface DatabaseStore {
    db: IDatabase;
    initialized: boolean;
    init: () => Promise<void>;
}

export const useDatabaseStore = create<DatabaseStore>()((set) => ({
    db: DatabaseImplementation.getInstance(),
    initialized: false,
    init: async () => {
        const db = DatabaseImplementation.getInstance();
        await db.init();
        set({ initialized: true });
    },
}));
