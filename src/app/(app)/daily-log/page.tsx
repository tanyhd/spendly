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
import ChevronDown from '@/common/icons/ChevronDown';
import ChevronUp from '@/common/icons/ChevronUp';
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
    const [catDropOpen, setCatDropOpen] = useState(false);
    const [catSearch, setCatSearch] = useState('');

    const todayInt = toDateInt(new Date());
    const weekDates = getWeekDates(weekStart);

    useEffect(() => {
        setLoading(true);
        setAddingDate(null);
        setEditingId(null);
        setCatDropOpen(false);
        fetch(`/api/daily-log?weekStart=${toDateInt(weekStart)}`)
            .then(r => r.ok ? r.json() : [])
            .then(setEntries)
            .finally(() => setLoading(false));
    }, [weekStart]);

    useEffect(() => {
        if (!catDropOpen) return;
        function handleClick(e: MouseEvent) {
            if (!(e.target as Element).closest('[data-cat-drop]')) setCatDropOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [catDropOpen]);

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
                setCatSearch('');
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
                setCatDropOpen(false);
                setCatSearch('');
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
    const SelectedCatIcon = CATEGORY_ICONS[addForm.category] ?? OthersGrid;
    const selectedCatColor = CATEGORY_COLORS[addForm.category] ?? '#6B7280';
    const SelectedEditCatIcon = CATEGORY_ICONS[editForm.category] ?? OthersGrid;
    const selectedEditCatColor = CATEGORY_COLORS[editForm.category] ?? '#6B7280';
    const catSorted = Object.entries(
        entries.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]);

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className="pageTitle">Daily Expense Log</h1>
                    <p className="pageSubtitle">Track your daily spending week by week.</p>
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
                                    <button
                                        className={styles.addBtn}
                                        onClick={() => { setAddingDate(dateInt); setAddForm(emptyForm()); setEditingId(null); setCatDropOpen(false); setCatSearch(''); }}
                                    >
                                        + Add
                                    </button>
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
                                        return (
                                            <div key={entry._id} className={styles.entry}>
                                                <div className={styles.entryIconWrap} style={{ background: `${color}20` }}>
                                                    <Icon style={{ color }} width="18" height="18" />
                                                </div>
                                                <div className={styles.entryInfo}>
                                                    <span className={styles.entryCat}>{entry.category}</span>
                                                    {entry.note && <span className={styles.entryNote}>{entry.note}</span>}
                                                </div>
                                                <span className={styles.entryAmt}>${fmt(entry.amount)}</span>
                                                <div className={styles.entryActions}>
                                                    <button className={styles.editBtn} onClick={() => { setEditingId(entry._id); setEditForm({ category: entry.category, amount: String(entry.amount), note: entry.note }); setAddingDate(null); setCatDropOpen(false); setCatSearch(''); }} title="Edit">✏</button>
                                                    <button className={styles.deleteEntryBtn} onClick={() => handleDelete(entry._id)} title="Delete"><Trash /></button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                </div>

                                {/* Daily subtotal */}
                                <div className={styles.dayFooter}>
                                    <span className={styles.subtotalLabel}>Daily Subtotal</span>
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
                            <span className={styles.totalLabel}>Total Spending</span>
                            <span className={styles.totalAmt}>${fmt(weekTotal)}</span>
                        </div>

                        <div className={styles.catBreakdown}>
                            <span className={styles.catBreakdownLabel}>Category Breakdown</span>
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

            {/* Edit Transaction Modal */}
            {editingId !== null && (
                <div className={styles.modalOverlay} onMouseDown={() => { setEditingId(null); setCatDropOpen(false); }}>
                    <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
                        <h2 className={styles.modalTitle}>Edit Transaction</h2>

                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>Amount</label>
                            <div className={styles.modalAmountWrap}>
                                <span className={styles.modalCurrency}>$</span>
                                <input
                                    className={styles.modalAmountInput}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={editForm.amount}
                                    onKeyDown={blockInvalid}
                                    onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>Category</label>
                            <div className={styles.catSelector} data-cat-drop="true">
                                <button
                                    className={cx(styles.catSelectorBtn, catDropOpen && styles.catSelectorBtnOpen)}
                                    onClick={() => setCatDropOpen(o => !o)}
                                >
                                    <div className={styles.catSelectorLeft}>
                                        <div className={styles.catSelectorIcon} style={{ background: `${selectedEditCatColor}20` }}>
                                            <SelectedEditCatIcon style={{ color: selectedEditCatColor }} width="16" height="16" />
                                        </div>
                                        <span className={styles.catSelectorName}>{editForm.category}</span>
                                    </div>
                                    <span className={styles.catChevron}>{catDropOpen ? <ChevronUp width="18" height="18" /> : <ChevronDown width="18" height="18" />}</span>
                                </button>
                                {catDropOpen && (
                                    <div className={styles.catList}>
                                        <div className={styles.catSearchWrap}>
                                            <input
                                                className={styles.catSearchInput}
                                                placeholder="Search categories..."
                                                value={catSearch}
                                                onChange={e => setCatSearch(e.target.value)}
                                            />
                                        </div>
                                        <div className={styles.catListItems}>
                                            {DAILY_CATEGORIES
                                                .filter(c => c.toLowerCase().includes(catSearch.toLowerCase()))
                                                .map(c => {
                                                    const CatIcon = CATEGORY_ICONS[c] ?? OthersGrid;
                                                    const catColor = CATEGORY_COLORS[c] ?? '#6B7280';
                                                    return (
                                                        <button
                                                            key={c}
                                                            className={cx(styles.catListItem, editForm.category === c && styles.catListItemActive)}
                                                            onClick={() => { setEditForm({ ...editForm, category: c }); setCatDropOpen(false); setCatSearch(''); }}
                                                        >
                                                            <div className={styles.catListIcon} style={{ background: `${catColor}20` }}>
                                                                <CatIcon style={{ color: catColor }} width="14" height="14" />
                                                            </div>
                                                            <span className={styles.catListName}>{c}</span>
                                                            {editForm.category === c && <span className={styles.catCheck}>✓</span>}
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>Note</label>
                            <input
                                className={styles.modalNoteInput}
                                type="text"
                                placeholder="Optional"
                                value={editForm.note}
                                onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') { setEditingId(null); setCatDropOpen(false); } }}
                            />
                        </div>

                        <div className={styles.modalBtns}>
                            <button className={styles.modalCancelBtn} onClick={() => { setEditingId(null); setCatDropOpen(false); }}>Cancel</button>
                            <button className={styles.modalAddBtn} onClick={handleUpdate} disabled={saving || !editForm.amount || parseFloat(editForm.amount) <= 0}>
                                {saving ? '...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Transaction Modal */}
            {addingDate !== null && (
                <div className={styles.modalOverlay} onMouseDown={() => { setAddingDate(null); setCatDropOpen(false); }}>
                    <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
                        <h2 className={styles.modalTitle}>Add Transaction</h2>

                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>Amount</label>
                            <div className={styles.modalAmountWrap}>
                                <span className={styles.modalCurrency}>$</span>
                                <input
                                    className={styles.modalAmountInput}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={addForm.amount}
                                    onKeyDown={blockInvalid}
                                    onChange={e => setAddForm({ ...addForm, amount: e.target.value })}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>Category</label>
                            <div className={styles.catSelector} data-cat-drop="true">
                                <button
                                    className={cx(styles.catSelectorBtn, catDropOpen && styles.catSelectorBtnOpen)}
                                    onClick={() => setCatDropOpen(o => !o)}
                                >
                                    <div className={styles.catSelectorLeft}>
                                        <div className={styles.catSelectorIcon} style={{ background: `${selectedCatColor}20` }}>
                                            <SelectedCatIcon style={{ color: selectedCatColor }} width="16" height="16" />
                                        </div>
                                        <span className={styles.catSelectorName}>{addForm.category}</span>
                                    </div>
                                    <span className={styles.catChevron}>{catDropOpen ? <ChevronUp width="18" height="18" /> : <ChevronDown width="18" height="18" />}</span>
                                </button>
                                {catDropOpen && (
                                    <div className={styles.catList}>
                                        <div className={styles.catSearchWrap}>
                                            <input
                                                className={styles.catSearchInput}
                                                placeholder="Search categories..."
                                                value={catSearch}
                                                onChange={e => setCatSearch(e.target.value)}
                                            />
                                        </div>
                                        <div className={styles.catListItems}>
                                            {DAILY_CATEGORIES
                                                .filter(c => c.toLowerCase().includes(catSearch.toLowerCase()))
                                                .map(c => {
                                                    const CatIcon = CATEGORY_ICONS[c] ?? OthersGrid;
                                                    const catColor = CATEGORY_COLORS[c] ?? '#6B7280';
                                                    return (
                                                        <button
                                                            key={c}
                                                            className={cx(styles.catListItem, addForm.category === c && styles.catListItemActive)}
                                                            onClick={() => { setAddForm({ ...addForm, category: c }); setCatDropOpen(false); setCatSearch(''); }}
                                                        >
                                                            <div className={styles.catListIcon} style={{ background: `${catColor}20` }}>
                                                                <CatIcon style={{ color: catColor }} width="14" height="14" />
                                                            </div>
                                                            <span className={styles.catListName}>{c}</span>
                                                            {addForm.category === c && <span className={styles.catCheck}>✓</span>}
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>Note</label>
                            <input
                                className={styles.modalNoteInput}
                                type="text"
                                placeholder="Optional"
                                value={addForm.note}
                                onChange={e => setAddForm({ ...addForm, note: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAddingDate(null); setCatDropOpen(false); } }}
                            />
                        </div>

                        <div className={styles.modalBtns}>
                            <button className={styles.modalCancelBtn} onClick={() => { setAddingDate(null); setCatDropOpen(false); }}>Cancel</button>
                            <button className={styles.modalAddBtn} onClick={handleAdd} disabled={saving || !addForm.amount || parseFloat(addForm.amount) <= 0}>
                                {saving ? '...' : 'Add Entry'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
