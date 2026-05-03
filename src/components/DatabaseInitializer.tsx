import { useEffect } from 'react';
import { useDatabaseStore } from '../stores/useDatabaseStore';
import { useListStore } from '../stores/useListStore';
import { LoadingScreen } from './LoadingScreen';

export function DatabaseInitializer({ children }: { children: React.ReactNode }) {
    const initialized = useDatabaseStore(s => s.initialized);
    const init = useDatabaseStore(s => s.init);

    useEffect(() => {
        init()
            .then(() => { useListStore.persist.rehydrate(); })
            .catch(err => console.error('Database initialization failed', err));
    }, [init]);

    if (!initialized) return <LoadingScreen />;
    return <>{children}</>;
}
