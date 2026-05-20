'use client';

import { useState, useEffect } from 'react';
import cx from 'classnames';
import Trash from '@/common/icons/Trash';
import FoodDining from '@/common/icons/FoodDining';
import TransportCar from '@/common/icons/TransportCar';
import ShoppingBag from '@/common/icons/ShoppingBag';
import HealthHeart from '@/common/icons/HealthHeart';
import EntertainmentIcon from '@/common/icons/EntertainmentIcon';
import EducationBook from '@/common/icons/EducationBook';
import UtilitiesBolt from '@/common/icons/UtilitiesBolt';
import OthersGrid from '@/common/icons/OthersGrid';
import AnnualOverview from '@/common/icons/AnnualOverview';
import styles from './DailyLog.module.css';

const DAILY_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Education', 'Utilities', 'Others'] as const;

const CATEGORY_COLORS: Record<string, string> = {
    Food: '#F59E0B',
    Transport: '#3B82F6',
    Shopping: '#EC4899',
    Health: '#EF4444',
    Entertainment: '#8B5CF6',
    Education: '#06B6D4',
    Utilities: '#F97316',
    Others: '#6B7280',
};

const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
    Food: FoodDining,
    Transport: TransportCar,
    Shopping: ShoppingBag,
    Health: HealthHeart,
    Entertainment: EntertainmentIcon,
    Education: EducationBook,
    Utilities: UtilitiesBolt,
    Others: OthersGrid,
};

type Entry = { _id: string; date: number; category: string; amount: number; note: string };
type EntryForm = { category: string; amount: string; note: string };

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}

function getWeekDates(ws: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(ws);
        d.setDate(d.getDate() + i);
        return d;
    });
}

function toDateInt(d: Date): number {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function fmtWeekRange(ws: Date): string {
    const end = new Date(ws);
    end.setDate(end.getDate() + 6);
    const sm = ws.toLocaleDateString('en-US', { month: 'short' });
    const em = end.toLocaleDateString('en-US', { month: 'short' });
    const sy = ws.getFullYear();
    if (sm === em) return `${sm} ${ws.getDate()}–${end.getDate()} ${sy}`;
    return `${sm} ${ws.getDate()} – ${em} ${end.getDate()} ${sy}`;
}

function fmt(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function blockInvalid(e: React.KeyboardEvent<HTMLInputElement>) {
    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
}

const emptyForm = (): EntryForm => ({ category: 'Food', amount: '', note: '' });

export default function DailyLogPage() {
    const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [addingDate, setAddingDate] = useState<number | null>(null);
    const [addForm, setAddForm] = useState<EntryForm>(emptyForm());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<EntryForm>(emptyForm());
    const [saving, setSaving] = useState(false);

    const todayInt = toDateInt(new Date());
    const weekDates = getWeekDates(weekStart);

    useEffect(() => {
        setLoading(true);
        setAddingDate(null);
        setEditingId(null);
        fetch(`/api/daily-log?weekStart=${toDateInt(weekStart)}`)
            .then(r => r.ok ? r.json() : [])
            .then(setEntries)
            .finally(() => setLoading(false));
    }, [weekStart]);

    function prevWeek() {
        setWeekStart(w => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; });
    }
    function nextWeek() {
        setWeekStart(w => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; });
    }

    async function handleAdd() {
        if (!addingDate || !addForm.amount || parseFloat(addForm.amount) <= 0) return;
        setSaving(true);
        try {
            const res = await fetch('/api/daily-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: addingDate, category: addForm.category, amount: parseFloat(addForm.amount), note: addForm.note }),
            });
            if (res.ok) {
                const entry = await res.json();
                setEntries(prev => [...prev, entry]);
                setAddForm(emptyForm());
                setAddingDate(null);
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdate() {
        if (!editingId) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/daily-log/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: editForm.category, amount: parseFloat(editForm.amount), note: editForm.note }),
            });
            if (res.ok) {
                setEntries(prev => prev.map(e =>
                    e._id === editingId
                        ? { ...e, category: editForm.category, amount: parseFloat(editForm.amount) || 0, note: editForm.note }
                        : e
                ));
                setEditingId(null);
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        await fetch(`/api/daily-log/${id}`, { method: 'DELETE' });
        setEntries(prev => prev.filter(e => e._id !== id));
        if (editingId === id) setEditingId(null);
    }

    const byDate: Record<number, Entry[]> = {};
    for (const e of entries) {
        if (!byDate[e.date]) byDate[e.date] = [];
        byDate[e.date].push(e);
    }

    const weekTotal = entries.reduce((s, e) => s + e.amount, 0);
    const catSorted = Object.entries(
        entries.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]);

    function renderForm(form: EntryForm, setForm: (f: EntryForm) => void, onSave: () => void, onCancel: () => void, label: string) {
        return (
            <div className={styles.form}>
                <select
                    className={styles.catSelect}
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    style={{ borderColor: CATEGORY_COLORS[form.category], color: CATEGORY_COLORS[form.category] }}
                >
                    {DAILY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className={styles.amountWrap}>
                    <span className={styles.currency}>$</span>
                    <input
                        className={styles.amountInput}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={form.amount}
                        onKeyDown={blockInvalid}
                        onChange={e => setForm({ ...form, amount: e.target.value })}
                        autoFocus
                    />
                </div>
                <input
                    className={styles.noteInput}
                    type="text"
                    placeholder="Note (optional)"
                    value={form.note}
                    onChange={e => setForm({ ...form, note: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
                />
                <div className={styles.formBtns}>
                    <button className={styles.saveBtn} onClick={onSave} disabled={saving || !form.amount}>{saving ? '...' : label}</button>
                    <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Daily Expense Log</h1>
                    <p className={styles.subtitle}>Track your daily spending week by week.</p>
                </div>
                <div className={styles.weekNav}>
                    <button className={styles.weekNavBtn} onClick={prevWeek}>&#8249;</button>
                    <span className={styles.weekLabel}>{fmtWeekRange(weekStart)}</span>
                    <button className={styles.weekNavBtn} onClick={nextWeek}>&#8250;</button>
                </div>
            </div>

            <div className={styles.content}>
                {/* Day cards — vertical list */}
                <div className={styles.dayList}>
                    {loading ? (
                        <p className={styles.loading}>Loading...</p>
                    ) : weekDates.map(date => {
                        const dateInt = toDateInt(date);
                        const dayEntries = byDate[dateInt] ?? [];
                        const dayTotal = dayEntries.reduce((s, e) => s + e.amount, 0);
                        const isToday = dateInt === todayInt;
                        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                        const dayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                        return (
                            <div key={dateInt} className={cx(styles.dayCard, isToday && styles.dayCardToday)}>
                                {/* Day header */}
                                <div className={styles.dayCardHeader}>
                                    <div className={styles.dayTitleWrap}>
                                        <span className={cx(styles.dayName, isToday && styles.dayNameToday)}>{dayName}</span>
                                        <span className={styles.dayDate}>{dayDate}</span>
                                        {isToday && <span className={styles.todayPill}>Today</span>}
                                    </div>
                                    {addingDate !== dateInt && editingId == null && (
                                        <button
                                            className={styles.addBtn}
                                            onClick={() => { setAddingDate(dateInt); setAddForm(emptyForm()); setEditingId(null); }}
                                        >
                                            + Add
                                        </button>
                                    )}
                                </div>

                                {/* Entries */}
                                <div className={styles.entryList}>
                                    {dayEntries.length === 0 && addingDate !== dateInt && (
                                        <div className={styles.emptyDay}>
                                            <span className={styles.emptyDayDot}>◎</span>
                                            No expenses today
                                        </div>
                                    )}

                                    {dayEntries.map(entry => {
                                        const Icon = CATEGORY_ICONS[entry.category] ?? OthersGrid;
                                        const color = CATEGORY_COLORS[entry.category] ?? '#6B7280';
                                        return editingId === entry._id ? (
                                            <div key={entry._id} className={styles.editWrap}>
                                                {renderForm(editForm, setEditForm, handleUpdate, () => setEditingId(null), 'Save')}
                                            </div>
                                        ) : (
                                            <div key={entry._id} className={styles.entry}>
                                                <div
                                                    className={styles.entryIconWrap}
                                                    style={{ background: `${color}20` }}
                                                >
                                                    <Icon style={{ color }} width="18" height="18" />
                                                </div>
                                                <div className={styles.entryInfo}>
                                                    <span className={styles.entryCat}>{entry.category}</span>
                                                    {entry.note && <span className={styles.entryNote}>{entry.note}</span>}
                                                </div>
                                                <span className={styles.entryAmt}>${fmt(entry.amount)}</span>
                                                <div className={styles.entryActions}>
                                                    <button className={styles.editBtn} onClick={() => { setEditingId(entry._id); setEditForm({ category: entry.category, amount: String(entry.amount), note: entry.note }); setAddingDate(null); }} title="Edit">✏</button>
                                                    <button className={styles.deleteEntryBtn} onClick={() => handleDelete(entry._id)} title="Delete"><Trash /></button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {addingDate === dateInt && renderForm(addForm, setAddForm, handleAdd, () => setAddingDate(null), 'Add')}
                                </div>

                                {/* Daily subtotal */}
                                <div className={styles.dayFooter}>
                                    <span className={styles.subtotalLabel}>DAILY SUBTOTAL</span>
                                    <span className={cx(styles.subtotalAmt, dayTotal > 0 && styles.subtotalAmtActive)}>
                                        ${fmt(dayTotal)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Weekly Summary Sidebar */}
                {!loading && (
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarHeader}>
                            <div className={styles.sidebarIconWrap}>
                                <AnnualOverview width="18" height="18" />
                            </div>
                            <h3 className={styles.sidebarTitle}>Weekly Summary</h3>
                        </div>
                        <p className={styles.sidebarRange}>{fmtWeekRange(weekStart)}</p>

                        <div className={styles.totalBlock}>
                            <span className={styles.totalLabel}>TOTAL SPENDING</span>
                            <span className={styles.totalAmt}>${fmt(weekTotal)}</span>
                        </div>

                        <div className={styles.catBreakdown}>
                            <span className={styles.catBreakdownLabel}>CATEGORY BREAKDOWN</span>
                            {catSorted.length === 0 ? (
                                <p className={styles.catEmpty}>No spending this week</p>
                            ) : catSorted.map(([cat, amt]) => {
                                const Icon = CATEGORY_ICONS[cat] ?? OthersGrid;
                                const color = CATEGORY_COLORS[cat] ?? '#6B7280';
                                return (
                                    <div key={cat} className={styles.catItem}>
                                        <div className={styles.catIconWrap} style={{ background: `${color}20` }}>
                                            <Icon style={{ color }} width="14" height="14" />
                                        </div>
                                        <span className={styles.catName}>{cat}</span>
                                        <span className={styles.catAmt}>${fmt(amt)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}
