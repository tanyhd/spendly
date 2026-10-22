'use client';

import { useState, useEffect, useCallback } from 'react';
import cx from 'classnames';
import { dailyCategory } from '@/common/constants/categories';
import { useExpense, type Entry } from '@/context/ExpenseContext';
import { useToast } from '@/context/ToastContext';
import WeekPicker from '@/common/components/WeekPicker';
import CategoryTag from '@/common/components/CategoryTag';
import { DOW, fmt, fmtDayShort, getWeekStart, toDateInt, todayInt } from '@/lib/format';
import styles from './DailyLog.module.css';

export default function DailyLogPage() {
    const { openAdd, openEdit, version } = useExpense();
    const toast = useToast();
    const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loadedWeek, setLoadedWeek] = useState(0);
    const [reload, setReload] = useState(0);
    const [showCats, setShowCats] = useState(false);

    const weekInt = toDateInt(weekStart);
    const today = todayInt();

    // Refetch on week change, after a shell add (version) and after undo (reload)
    useEffect(() => {
        let cancelled = false;
        fetch(`/api/daily-log?weekStart=${weekInt}`)
            .then(r => r.ok ? r.json() : [])
            .then((list: Entry[]) => {
                if (cancelled) return;
                setEntries(list);
                setLoadedWeek(weekInt);
            });
        return () => { cancelled = true; };
    }, [weekInt, version, reload]);

    const loading = loadedWeek !== weekInt;

    const handleDelete = useCallback(async (entry: Entry) => {
        const res = await fetch(`/api/daily-log/${entry._id}`, { method: 'DELETE' });
        if (!res.ok) return toast('COULD NOT DELETE · TRY AGAIN');
        setEntries(prev => prev.filter(e => e._id !== entry._id));
        toast({
            msg: `DELETED ${entry.category.toUpperCase()} $${fmt(entry.amount)} · ${fmtDayShort(entry.date)}`,
            undo: async () => {
                await fetch('/api/daily-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: entry.date, category: entry.category, amount: entry.amount, note: entry.note }),
                });
                setReload(r => r + 1);
            },
        });
    }, [toast]);

    function handleEdit(entry: Entry) {
        openEdit(entry, updated => setEntries(prev => prev.map(e => e._id === updated._id ? updated : e)));
    }

    const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return toDateInt(d);
    });
    const byDate: Record<number, Entry[]> = {};
    for (const e of entries) (byDate[e.date] ??= []).push(e);
    const sums = dates.map(d => (byDate[d] ?? []).reduce((s, e) => s + e.amount, 0));
    const total = sums.reduce((s, v) => s + v, 0);
    const maxDay = Math.max(1, ...sums);
    const daysSoFar = Math.max(1, dates.filter(d => d <= today).length);

    const catTotals: Record<string, number> = {};
    for (const e of entries) catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount;
    const cats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const catMax = cats[0]?.[1] ?? 1;

    return (
        <div className={styles.page}>
            <div className={styles.toolbar}>
                <WeekPicker weekStart={weekStart} onChange={setWeekStart} showToday className={styles.picker} />
                <span className={styles.toolbarInfo}>MON → SUN · {entries.length} ENTRIES</span>
            </div>

            <div className={styles.layout}>
                {/* Days */}
                <div className={cx(styles.days, loading && styles.dim)}>
                    {dates.map((dateInt, i) => {
                        const items = byDate[dateInt] ?? [];
                        const isToday = dateInt === today;
                        const future = dateInt > today;
                        const empty = items.length === 0;
                        return (
                            <section key={dateInt} className={cx(styles.day, isToday && styles.dayToday)}>
                                <div className={cx(styles.dayHead, empty && styles.dayHeadEmpty)}>
                                    <span className={cx(styles.dow, isToday && styles.dowToday, future && styles.dowFuture)}>{DOW[i]}</span>
                                    <span className={styles.date}>{fmtDayShort(dateInt)}</span>
                                    {isToday && <span className={styles.todayBadge}>TODAY</span>}
                                    {empty && !future && <span className={styles.emptyText}>No expenses</span>}
                                    <span className={cx(styles.subtotal, 'num')}>{empty ? '' : fmt(sums[i])}</span>
                                    <button
                                        className={cx(styles.addBtn, isToday && styles.addBtnToday)}
                                        onClick={() => openAdd(dateInt)}
                                    >
                                        + ADD
                                    </button>
                                </div>
                                {items.map(e => (
                                    <div key={e._id} className={styles.item}>
                                        <CategoryTag category={dailyCategory(e.category)} />
                                        <span className={styles.itemMain}>
                                            <span className={styles.itemCat}>{e.category}</span>
                                            <span className={styles.itemNote}>{e.note || '—'}</span>
                                        </span>
                                        <span className={cx(styles.itemAmt, 'num')}>−{fmt(e.amount)}</span>
                                        <button className={styles.editBtn} onClick={() => handleEdit(e)} aria-label="Edit">EDIT</button>
                                        <button className={styles.deleteBtn} onClick={() => handleDelete(e)} aria-label="Delete">✕</button>
                                    </div>
                                ))}
                            </section>
                        );
                    })}
                </div>

                {/* Week summary */}
                <aside className={styles.summary}>
                    <div className={styles.totalBlock}>
                        <span className="label">Week total</span>
                        <span className={cx(styles.total, 'num')} style={{ color: total ? 'var(--primary)' : 'var(--muted)' }}>{fmt(total)}</span>
                        <span className={styles.note}>
                            {total ? `AVG ${fmt(total / daysSoFar)} / DAY · ${entries.length} ENTRIES` : 'NO EXPENSES THIS WEEK'}
                        </span>
                    </div>

                    <div className={styles.byDay}>
                        <span className="label">By day</span>
                        <div className={styles.bars}>
                            {dates.map((d, i) => (
                                <div
                                    key={d}
                                    title={`${fmtDayShort(d)} · $${fmt(sums[i])}`}
                                    style={{
                                        height: `${(sums[i] / maxDay) * 100}%`,
                                        background: d === today ? 'var(--primary)' : sums[i] ? 'var(--heat-2)' : 'var(--s2)',
                                    }}
                                />
                            ))}
                        </div>
                        <div className={styles.barLabels}>
                            {dates.map((d, i) => (
                                <span key={d} style={{ color: d === today ? 'var(--primary)' : undefined }}>{DOW[i][0]}</span>
                            ))}
                        </div>
                    </div>

                    <div className={cx(styles.cats, !showCats && styles.catsCollapsed)}>
                        <span className="label">By category</span>
                        {cats.length === 0 ? (
                            <span className={styles.catsEmpty}>Nothing logged this week. Use + ADD on any day, or press N.</span>
                        ) : cats.map(([cat, amt]) => {
                            const c = dailyCategory(cat);
                            return (
                                <div key={cat} className={styles.catItem}>
                                    <div className={styles.catLine}>
                                        <span className={styles.catName}><span className={styles.swatch} style={{ background: c.color }} />{cat.toUpperCase()}</span>
                                        <span className="num">{fmt(amt)}</span>
                                    </div>
                                    <div className={styles.catTrack}><div style={{ width: `${(amt / catMax) * 100}%`, background: c.color }} /></div>
                                </div>
                            );
                        })}
                    </div>
                    <button className={styles.catsToggle} onClick={() => setShowCats(s => !s)}>
                        {showCats ? 'HIDE CATEGORIES' : `SHOW ${cats.length} CATEGORIES`}
                        <span className={cx(styles.caret, showCats && styles.caretUp)} aria-hidden="true" />
                    </button>
                </aside>
            </div>
        </div>
    );
}
