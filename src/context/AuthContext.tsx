'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    userId: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    async function fetchUser() {
        return fetch('/api/auth/me')
            .then(res => (res.ok ? res.json() : null))
            .then(data => setUser(data));
    }

    useEffect(() => {
        fetchUser().finally(() => setLoading(false));
    }, []);

    async function refreshUser() {
        await fetchUser();
    }

    async function logout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
        router.push('/login');
    }

    return (
        <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
