import React, { createContext, useContext, useEffect, useState } from 'react';
import { DatabaseImplementation, type IDatabase } from '../services/Database';
import { LoadingScreen } from '../components/LoadingScreen';

const DatabaseContext = createContext<IDatabase | null>(null);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [db] = useState<IDatabase>(() => DatabaseImplementation.getInstance());
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                await db.init();
                setInitialized(true);
            } catch (err) {
                console.error("Database initialization failed", err);
            }
        };
        init();
    }, [db]);

    if (!initialized) {
        return <LoadingScreen />;
    }

    return (
        <DatabaseContext.Provider value={db}>
            {children}
        </DatabaseContext.Provider>
    );
};

export const useDatabase = () => {
    const context = useContext(DatabaseContext);
    if (!context) {
        throw new Error('useDatabase must be used within a DatabaseProvider');
    }
    return context;
};


