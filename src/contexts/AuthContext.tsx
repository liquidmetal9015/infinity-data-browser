import React, { createContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, loginWithGoogle, logout } from "../services/firebase";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_AUTH = import.meta.env.VITE_DEV_AUTH === 'true';
const STATIC_MODE = import.meta.env.VITE_DEPLOY_MODE === 'static';
const BYPASS_AUTH = DEV_AUTH || STATIC_MODE;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(BYPASS_AUTH ? ({ uid: STATIC_MODE ? 'local' : 'dev-user', email: STATIC_MODE ? 'local' : 'dev@local' } as User) : null);
    const [loading, setLoading] = useState(!BYPASS_AUTH);

    useEffect(() => {
        if (BYPASS_AUTH) return;
        const unsubscribe = onAuthStateChanged(auth!, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        if (!STATIC_MODE) await loginWithGoogle();
    };

    const handleLogout = async () => {
        if (!STATIC_MODE) await logout();
    };

    return (
        <AuthContext.Provider value={{ user, loading, login: handleLogin, logout: handleLogout }}>
            {children}
        </AuthContext.Provider>
    );
};

