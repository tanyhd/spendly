'use client';

import { createContext, useCallback, useContext, useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

/** Called instead of leaving the page; call `proceed` to leave after all */
type Guard = (proceed: () => void) => void;

interface NavigationGuardType {
    setGuard: (guard: Guard | null) => void;
    /** Runs `proceed` now, or hands it to the active guard to decide */
    leave: (proceed: () => void) => void;
}

const NavigationGuardContext = createContext<NavigationGuardType | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const guardRef = useRef<Guard | null>(null);

    const setGuard = useCallback((guard: Guard | null) => { guardRef.current = guard; }, []);
    const leave = useCallback((proceed: () => void) => {
        if (guardRef.current) guardRef.current(proceed);
        else proceed();
    }, []);

    // Catch in-app link clicks (capture phase, before Next's <Link> handles them)
    useEffect(() => {
        function onClick(e: MouseEvent) {
            const guard = guardRef.current;
            if (!guard || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
            if (!a || a.target === '_blank' || a.origin !== window.location.origin) return;
            const href = a.pathname + a.search;
            if (href === window.location.pathname + window.location.search) return;
            e.preventDefault();
            e.stopPropagation();
            guard(() => router.push(href));
        }
        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, [router]);

    return (
        <NavigationGuardContext.Provider value={{ setGuard, leave }}>
            {children}
        </NavigationGuardContext.Provider>
    );
}

export function useNavigationGuard() {
    const ctx = useContext(NavigationGuardContext);
    if (!ctx) throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
    return ctx;
}
