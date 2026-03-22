import { useDatabaseStore } from '../stores/useDatabaseStore';

export const useDatabase = () => useDatabaseStore(s => s.db);
