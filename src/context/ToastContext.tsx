'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import styles from './Toast.module.css';

type Toast = { msg: string; undo?: () => void | Promise<void> };

const ToastContext = createContext<((t: Toast | string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toast, setToast] = useState<Toast | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = useCallback((t: Toast | string) => {
        if (timer.current) clearTimeout(timer.current);
        setToast(typeof t === 'string' ? { msg: t } : t);
        timer.current = setTimeout(() => setToast(null), 5000);
    }, []);

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    async function handleUndo() {
        const undo = toast?.undo;
        setToast(null);
        if (undo) {
            await undo();
            show('RESTORED');
        }
    }

    return (
        <ToastContext.Provider value={show}>
            {children}
            {toast && (
                <div className={styles.toast} role="status">
                    <span className={styles.msg}>{toast.msg}</span>
                    {toast.undo && <button className={styles.undo} onClick={handleUndo}>UNDO</button>}
                </div>
            )}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
