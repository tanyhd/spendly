'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import ExpenseSheet from '@/common/components/ExpenseSheet';

export type Entry = { _id: string; date: number; category: string; amount: number; note: string };

export type SheetState =
    | { mode: 'add'; date?: number }
    | { mode: 'edit'; entry: Entry; onSaved?: (e: Entry) => void };

interface ExpenseContextType {
    openAdd: (date?: number) => void;
    openEdit: (entry: Entry, onSaved?: (e: Entry) => void) => void;
    isOpen: boolean;
    /** Bumped after every add, so pages can refetch */
    version: number;
}

const ExpenseContext = createContext<ExpenseContextType | null>(null);

export function ExpenseProvider({ children }: { children: ReactNode }) {
    const [sheet, setSheet] = useState<SheetState | null>(null);
    const [version, setVersion] = useState(0);

    const openAdd = useCallback((date?: number) => setSheet({ mode: 'add', date }), []);
    const openEdit = useCallback((entry: Entry, onSaved?: (e: Entry) => void) => setSheet({ mode: 'edit', entry, onSaved }), []);

    return (
        <ExpenseContext.Provider value={{ openAdd, openEdit, isOpen: sheet !== null, version }}>
            {children}
            {sheet && (
                <ExpenseSheet
                    key={sheet.mode === 'edit' ? sheet.entry._id : 'add'}
                    sheet={sheet}
                    onClose={() => setSheet(null)}
                    onAdded={() => setVersion(v => v + 1)}
                />
            )}
        </ExpenseContext.Provider>
    );
}

export function useExpense() {
    const ctx = useContext(ExpenseContext);
    if (!ctx) throw new Error('useExpense must be used within ExpenseProvider');
    return ctx;
}
