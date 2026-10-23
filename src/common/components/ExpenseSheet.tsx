'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import cx from 'classnames';
import { DAILY_CATEGORIES } from '@/common/constants/categories';
import { useToast } from '@/context/ToastContext';
import type { Entry, SheetState } from '@/context/ExpenseContext';
import {
    DOW, fmt, fmtDayShort, fromDateInt, todayInt, addDaysInt, dateIntToIso, isoToDateInt,
} from '@/lib/format';
import styles from './ExpenseSheet.module.css';
import { cleanMoney } from '@/lib/input';

type Props = {
    sheet: SheetState;
    onClose: () => void;
    /** An expense was added or deleted (or a delete undone): pages refetch */
    onChanged: () => void;
};

export default function ExpenseSheet({ sheet, onClose, onChanged }: Props) {
    const toast = useToast();
    const isEdit = sheet.mode === 'edit';
    const today = todayInt();
    const yesterday = addDaysInt(today, -1);

    const [amount, setAmount] = useState(isEdit ? sheet.entry.amount.toFixed(2) : '');
    const [category, setCategory] = useState(isEdit ? sheet.entry.category : 'Food');
    const [date, setDate] = useState(isEdit ? sheet.entry.date : (sheet.date ?? today));
    const [note, setNote] = useState(isEdit ? sheet.entry.note : '');
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    // Asked before closing with something typed: "discard this expense?"
    const [confirming, setConfirming] = useState(false);
    const amountRef = useRef<HTMLInputElement>(null);

    const dirty = isEdit
        ? amount !== sheet.entry.amount.toFixed(2) || category !== sheet.entry.category || note !== sheet.entry.note
        : amount !== '' || note.trim() !== '';

    /** Esc, the overlay, ESC ✕ and CANCEL all come here: nothing typed closes, otherwise ask first */
    function requestClose() {
        if (dirty && !confirming) setConfirming(true);
        else onClose();
    }
    const closeRef = useRef(requestClose);
    useEffect(() => { closeRef.current = requestClose; });

    useEffect(() => {
        const t = setTimeout(() => amountRef.current?.focus(), 60);
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') closeRef.current();
        }
        window.addEventListener('keydown', onKey);
        return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
    }, []);

    /** Edit only: deletes the expense, with UNDO in the toast like everywhere else */
    async function handleDelete() {
        if (sheet.mode !== 'edit') return;
        const entry = sheet.entry;
        setSaving(true);
        const res = await fetch(`/api/daily-log/${entry._id}`, { method: 'DELETE' }).catch(() => null);
        setSaving(false);
        if (!res?.ok) return setError('Could not delete. Please try again.');
        onChanged();
        onClose();
        toast({
            msg: `DELETED ${entry.category.toUpperCase()} $${fmt(entry.amount)} · ${fmtDayShort(entry.date)}`,
            undo: async () => {
                await fetch('/api/daily-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: entry.date, category: entry.category, amount: entry.amount, note: entry.note }),
                });
                onChanged();
            },
        });
    }

    const q = search.trim().toLowerCase();
    const tiles = DAILY_CATEGORIES.filter(c => !q || c.id.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const amt = parseFloat(amount);
        if (!(amt > 0)) {
            setError('Amount must be greater than 0');
            amountRef.current?.focus();
            return;
        }
        setSaving(true);
        try {
            const label = `${category.toUpperCase()} $${fmt(amt)} · ${fmtDayShort(date)}`;
            if (sheet.mode === 'add') {
                const res = await fetch('/api/daily-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date, category, amount: amt, note }),
                });
                if (!res.ok) throw new Error();
                onChanged();
                toast(`ADDED ${label}`);
            } else {
                const res = await fetch(`/api/daily-log/${sheet.entry._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category, amount: amt, note }),
                });
                if (!res.ok) throw new Error();
                const updated: Entry = { ...sheet.entry, category, amount: amt, note };
                sheet.onSaved?.(updated);
                toast('SAVED CHANGES');
            }
            onClose();
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    const d = fromDateInt(date);
    const editDate = `${DOW[(d.getDay() + 6) % 7]} ${fmtDayShort(date)} ${d.getFullYear()}`;

    return (
        <>
            <div className={styles.overlay} onClick={requestClose} />
            <form
                className={styles.sheet}
                onSubmit={handleSubmit}
                role="dialog"
                aria-modal="true"
                aria-label={isEdit ? 'Edit expense' : 'New expense'}
            >
                <div className={styles.head}>
                    <span className={styles.title}>{isEdit ? 'EDIT EXPENSE' : 'NEW EXPENSE'}</span>
                    <button type="button" className={styles.esc} onClick={requestClose}>ESC ✕</button>
                </div>

                <div className={styles.body}>
                    <label className={cx(styles.section, styles.amountSection)}>
                        <span className="label">Amount</span>
                        <span className={styles.amountRow}>
                            <span className={styles.currency}>$</span>
                            <input
                                ref={amountRef}
                                className={styles.amountInput}
                                inputMode="decimal"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => { setAmount(cleanMoney(e.target.value)); setError(''); }}
                            />
                        </span>
                        {error && <span className={styles.error}>✕ {error}</span>}
                    </label>

                    <div className={styles.section}>
                        <span className="label">Date</span>
                        {isEdit ? (
                            <div className={styles.lockedDate}>
                                <span>{editDate}</span>
                                <span className={styles.lockedHint}>DATE CAN&apos;T BE CHANGED</span>
                            </div>
                        ) : (
                            <div className={styles.dateRow}>
                                {[{ label: 'TODAY', value: today }, { label: 'YESTERDAY', value: yesterday }].map(c => (
                                    <button
                                        key={c.label}
                                        type="button"
                                        className={cx(styles.chip, date === c.value && styles.chipActive)}
                                        onClick={() => setDate(c.value)}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                                <input
                                    type="date"
                                    className={styles.dateInput}
                                    value={dateIntToIso(date)}
                                    onChange={e => e.target.value && setDate(isoToDateInt(e.target.value))}
                                />
                            </div>
                        )}
                    </div>

                    <div className={styles.section}>
                        <div className={styles.catHead}>
                            <span className="label">Category</span>
                            <input
                                className={styles.search}
                                placeholder="/ search"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className={styles.tiles}>
                            {tiles.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    className={cx(styles.tile, category === c.id && styles.tileActive)}
                                    onClick={() => setCategory(c.id)}
                                >
                                    <span className={styles.tileCode}>
                                        <span className={styles.swatch} style={{ background: c.color }} />
                                        {c.code}
                                    </span>
                                    <span className={styles.tileName}>{c.id}</span>
                                </button>
                            ))}
                        </div>
                        {tiles.length === 0 && <span className={styles.noMatch}>No category matches &quot;{search}&quot;</span>}
                    </div>

                    <label className={cx(styles.section, styles.noteSection)}>
                        <span className="label">Note <span className={styles.optional}>· optional</span></span>
                        <input
                            className={styles.noteInput}
                            placeholder="e.g. Lunch"
                            maxLength={200} // the server's limit (MAX_NOTE in services/entries)
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </label>
                </div>

                {confirming && (
                    <div className={styles.confirm} role="alertdialog" aria-label="Discard changes">
                        <span className={styles.confirmText}>{isEdit ? 'Discard your changes to this expense?' : 'Discard this expense? It hasn’t been added.'}</span>
                        <button type="button" className={styles.confirmBtn} onClick={() => { setConfirming(false); amountRef.current?.focus(); }}>KEEP EDITING</button>
                        <button type="button" className={cx(styles.confirmBtn, styles.confirmDiscard)} onClick={onClose}>DISCARD</button>
                    </div>
                )}

                <div className={styles.foot}>
                    {isEdit
                        ? <button type="button" className={styles.deleteBtn} onClick={handleDelete} disabled={saving}>DELETE</button>
                        : <button type="button" className={styles.cancel} onClick={requestClose}>CANCEL</button>}
                    <button type="submit" className={styles.submit} disabled={saving}>
                        {saving ? 'SAVING…' : isEdit ? 'SAVE CHANGES ↵' : 'ADD ENTRY ↵'}
                    </button>
                </div>
            </form>
        </>
    );
}
