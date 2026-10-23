'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import cx from 'classnames';
import { DAILY_CATEGORIES, dailyCategory } from '@/common/constants/categories';
import { useExpense, type Entry } from '@/context/ExpenseContext';
import { useToast } from '@/context/ToastContext';
import CategoryTag from '@/common/components/CategoryTag';
import LogTabs from '@/common/components/LogTabs';
import { DOW, fmt, fmtDayShort, fromDateInt, isoToDateInt, dateIntToIso, todayInt } from '@/lib/format';
import { isTyping } from '@/lib/input';
import styles from './AllExpenses.module.css';

type Preset = 'this-month' | 'last-month' | 'last-3' | 'this-year' | 'all' | 'custom';
type Page = { items: Entry[]; nextCursor: string | null; total: { count: number; amount: number }; dayTotals: Record<number, number> };

const PRESETS: { id: Preset; label: string; inText: string }[] = [
    { id: 'this-month', label: 'THIS MONTH', inText: ' in this month' },
    { id: 'last-month', label: 'LAST MONTH', inText: ' in last month' },
    { id: 'last-3', label: 'LAST 3 MONTHS', inText: ' in the last 3 months' },
    { id: 'this-year', label: 'THIS YEAR', inText: ' this year' },
    { id: 'all', label: 'ALL TIME', inText: '' },
    { id: 'custom', label: 'CUSTOM', inText: ' in this range' },
];

const PAGE_SIZE = 40;

function monthStart(y: number, m: number) { return y * 10000 + m * 100 + 1; }
function monthEnd(y: number, m: number) { return y * 10000 + m * 100 + new Date(y, m, 0).getDate(); }

/** The date range a preset covers, as YYYYMMDD (none for all time) */
function presetRange(p: Preset, custom: { from: string; to: string }): { from?: number; to?: number } {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const back = (n: number) => { const x = new Date(y, m - 1 - n, 1); return { y: x.getFullYear(), m: x.getMonth() + 1 }; };
    switch (p) {
        case 'this-month': return { from: monthStart(y, m), to: monthEnd(y, m) };
        case 'last-month': { const l = back(1); return { from: monthStart(l.y, l.m), to: monthEnd(l.y, l.m) }; }
        case 'last-3': { const s = back(2); return { from: monthStart(s.y, s.m), to: monthEnd(y, m) }; }
        case 'this-year': return { from: y * 10000 + 101, to: y * 10000 + 1231 };
        case 'all': return {};
        case 'custom': return {
            ...(custom.from && { from: isoToDateInt(custom.from) }),
            ...(custom.to && { to: isoToDateInt(custom.to) }),
        };
    }
}

/** "OCT 19 2026" */
function fmtDay(n: number) {
    return `${fmtDayShort(n)} ${Math.floor(n / 10000)}`;
}

function dow(n: number) {
    return DOW[(fromDateInt(n).getDay() + 6) % 7];
}

// useSearchParams needs a Suspense boundary so the rest of the page can still be prerendered
export default function AllExpensesPage() {
    return <Suspense><AllExpenses /></Suspense>;
}

function AllExpenses() {
    const { openAdd, openEdit, version } = useExpense();
    const toast = useToast();
    const [q, setQ] = useState('');
    const [query, setQuery] = useState(''); // q after typing pauses
    // ?from=YYYYMMDD&to=YYYYMMDD (from the dashboard's VIEW ALL) opens as a custom range
    const search = useSearchParams();
    const linked = { from: search.get('from') ?? '', to: search.get('to') ?? '' };
    const fromLink = /^\d{8}$/.test(linked.from) && /^\d{8}$/.test(linked.to);
    const [preset, setPreset] = useState<Preset>(fromLink ? 'custom' : 'all');
    const [custom, setCustom] = useState(fromLink
        ? { from: dateIntToIso(Number(linked.from)), to: dateIntToIso(Number(linked.to)) }
        : { from: '', to: '' });
    const [error, setError] = useState('');
    const [cats, setCats] = useState<string[]>([]);
    const [data, setData] = useState<Page | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [reload, setReload] = useState(0);
    const searchRef = useRef<HTMLInputElement>(null);
    const today = todayInt();

    const range = presetRange(preset, custom);
    // A custom range the wrong way round: say so instead of asking the server
    const rangeError = range.from && range.to && range.from > range.to ? 'The From date is after the To date.' : '';
    const params = new URLSearchParams();
    if (range.from) params.set('from', String(range.from));
    if (range.to) params.set('to', String(range.to));
    if (cats.length) params.set('category', cats.join(','));
    if (query) params.set('q', query);
    const filterKey = params.toString();

    // Search waits for a pause in typing
    useEffect(() => {
        const t = setTimeout(() => setQuery(q.trim()), 250);
        return () => clearTimeout(t);
    }, [q]);

    // "/" jumps to search, like the wireframe says
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key !== '/' || isTyping(e.target) || e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            searchRef.current?.focus();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // First page whenever the filter changes, after an add (version) and after an edit/delete/undo (reload)
    useEffect(() => {
        if (rangeError) return;
        let cancelled = false;
        const p = new URLSearchParams(filterKey);
        p.set('limit', String(PAGE_SIZE));
        fetch(`/api/transactions?${p}`)
            .then(async r => ({ ok: r.ok, body: await r.json().catch(() => null) }))
            .catch(() => ({ ok: false, body: null }))
            .then(({ ok, body }) => {
                if (cancelled) return;
                if (ok) { setData(body as Page); setError(''); }
                else setError(body?.message ? `${body.message}.` : 'Could not load expenses. Try again.');
            });
        return () => { cancelled = true; };
    }, [filterKey, version, reload, rangeError]);

    async function loadMore() {
        if (!data?.nextCursor || loadingMore) return;
        setLoadingMore(true);
        const p = new URLSearchParams(filterKey);
        p.set('limit', String(PAGE_SIZE));
        p.set('cursor', data.nextCursor);
        const res = await fetch(`/api/transactions?${p}`).catch(() => null);
        const next: Page | null = res?.ok ? await res.json() : null;
        setLoadingMore(false);
        if (!next) return toast('COULD NOT LOAD MORE · TRY AGAIN');
        setData(d => d && {
            ...next,
            items: [...d.items, ...next.items],
            dayTotals: { ...d.dayTotals, ...next.dayTotals },
        });
    }

    const handleDelete = useCallback(async (entry: Entry) => {
        const res = await fetch(`/api/daily-log/${entry._id}`, { method: 'DELETE' });
        if (!res.ok) return toast('COULD NOT DELETE · TRY AGAIN');
        setReload(r => r + 1);
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

    function toggleCat(id: string) {
        setCats(list => list.includes(id) ? list.filter(c => c !== id) : [...list, id]);
    }

    function clearFilters() {
        setQ('');
        setQuery('');
        setPreset('all');
        setCats([]);
        setCustom({ from: '', to: '' });
    }

    // " in Food or Transport", for the no-results message
    const catText = cats.length ? ` in ${cats.join(cats.length === 2 ? ' or ' : ', ')}` : '';
    const filtered = Boolean(query) || preset !== 'all' || cats.length > 0;
    const problem = rangeError || error;
    const count = problem ? 0 : data?.total.count ?? 0;
    const presetInfo = PRESETS.find(p => p.id === preset)!;
    const rangeText = range.from || range.to
        ? `${range.from ? fmtDay(range.from) : 'START'} → ${range.to ? fmtDay(range.to) : 'TODAY'}`
        : 'ALL TIME';
    const metaText = [
        `${count} ${count === 1 ? 'EXPENSE' : 'EXPENSES'}`,
        rangeText,
        cats.length ? cats.map(c => dailyCategory(c).code).join(' ') : '',
        query ? `"${query}"` : '',
    ].filter(Boolean).join(' · ');

    // Group the loaded entries by day, newest first (the API already sorts them)
    const groups: { date: number; items: Entry[] }[] = [];
    for (const e of data?.items ?? []) {
        const last = groups[groups.length - 1];
        if (last?.date === e.date) last.items.push(e);
        else groups.push({ date: e.date, items: [e] });
    }

    const exportHref = `/api/transactions/export${filterKey ? `?${filterKey}` : ''}`;
    const left = count - (data?.items.length ?? 0);

    return (
        <div className={styles.page}>
            <LogTabs />

            <div className={styles.searchRow}>
                <label className={styles.search}>
                    <span className={styles.slash} aria-hidden="true">/</span>
                    <input
                        ref={searchRef}
                        className={styles.searchInput}
                        placeholder="Search notes or categories"
                        aria-label="Search notes or categories"
                        maxLength={100}
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') { setQ(''); searchRef.current?.blur(); } }}
                    />
                    {q && <button className={styles.clearQ} onClick={() => setQ('')} aria-label="Clear search">✕</button>}
                </label>
                <a
                    className={cx(styles.exportBtn, count === 0 && styles.exportOff)}
                    href={count ? exportHref : undefined}
                    role="link" // still a link (just disabled) when there's nothing to export
                    aria-disabled={count === 0}
                    download
                >
                    ↓ <span className={styles.desktopText}>EXPORT CSV · {count}</span><span className={styles.phoneText}>CSV</span>
                </a>
            </div>

            <div className={styles.presets} role="group" aria-label="Date range">
                {PRESETS.map(p => (
                    <button
                        key={p.id}
                        className={cx(styles.preset, preset === p.id && styles.presetOn)}
                        aria-pressed={preset === p.id}
                        onClick={() => setPreset(p.id)}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {preset === 'custom' && (
                <div className={styles.customRow}>
                    <label className={styles.dateField}>
                        <span className="label">From</span>
                        <input type="date" value={custom.from} max={custom.to || undefined} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} />
                    </label>
                    <label className={styles.dateField}>
                        <span className="label">To</span>
                        <input type="date" value={custom.to} min={custom.from || undefined} max={dateIntToIso(today)} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} />
                    </label>
                </div>
            )}

            <div className={styles.chips} role="group" aria-label="Categories">
                <button className={cx(styles.chip, cats.length === 0 && styles.chipOn)} aria-pressed={cats.length === 0} onClick={() => setCats([])}>ALL</button>
                {DAILY_CATEGORIES.map(c => (
                    <button
                        key={c.id}
                        className={cx(styles.chip, cats.includes(c.id) && styles.chipOn)}
                        aria-pressed={cats.includes(c.id)}
                        aria-label={c.id}
                        onClick={() => toggleCat(c.id)}
                    >
                        <span className={styles.swatch} style={{ background: c.color }} />
                        <span className={styles.desktopText}>{c.id.toUpperCase()}</span>
                        <span className={styles.phoneText}>{c.code}</span>
                    </button>
                ))}
            </div>

            <div className={styles.totalBar} data-testid="filter-total">
                <span className={cx(styles.totalAmt, 'num')} style={{ color: count ? 'var(--primary)' : 'var(--muted)' }}>
                    ${fmt(problem ? 0 : data?.total.amount ?? 0)}
                </span>
                <span className={styles.totalMeta}>{metaText}</span>
                {filtered && <button className={styles.clearBtn} onClick={clearFilters}>CLEAR FILTERS</button>}
            </div>

            {problem && (
                <div className={styles.empty} role="alert">
                    <p className={styles.emptyTitle}>{problem}</p>
                    <p className={styles.emptyText}>{rangeError ? 'Pick a From date on or before the To date.' : 'Change the filters or clear them.'}</p>
                    <button className={styles.emptyBtn} onClick={clearFilters}>CLEAR FILTERS</button>
                </div>
            )}

            {!problem && data && count === 0 && (
                filtered ? (
                    <div className={styles.empty}>
                        <p className={styles.emptyTitle}>
                            {query
                                ? `No expenses match "${query}"${catText}${presetInfo.inText}.`
                                : `No expenses${catText}${presetInfo.inText}.`}
                        </p>
                        <p className={styles.emptyText}>Try a wider date range, fewer categories or a shorter search.</p>
                        <button className={styles.emptyBtn} onClick={clearFilters}>CLEAR FILTERS</button>
                    </div>
                ) : (
                    <div className={styles.empty}>
                        <span className="label">All expenses</span>
                        <p className={styles.emptyTitle}>Nothing logged yet.</p>
                        <p className={styles.emptyText}>Every expense you add, from any day, collects here so you can search and export it later.</p>
                        <button className={styles.emptyBtn} onClick={() => openAdd()}>+ ADD YOUR FIRST EXPENSE</button>
                    </div>
                )
            )}

            <div className={cx(styles.list, !data && styles.dim)}>
                {!problem && groups.map(g => (
                    <section key={g.date} className={styles.day} aria-label={fmtDay(g.date)}>
                        <div className={styles.dayHead}>
                            <span className={cx(styles.dow, g.date === today && styles.dowToday)}>{dow(g.date)}</span>
                            <span className={styles.date}>{fmtDay(g.date)}</span>
                            {g.date === today && <span className={styles.todayBadge}>TODAY</span>}
                            <span className={cx(styles.dayTotal, 'num')}>{fmt(data?.dayTotals[g.date] ?? 0)}</span>
                        </div>
                        {g.items.map(e => (
                            <div key={e._id} className={styles.item} data-testid="expense-row">
                                <button
                                    className={styles.itemBtn}
                                    onClick={() => openEdit(e, () => setReload(r => r + 1))}
                                    aria-label={`Edit ${e.category} ${fmt(e.amount)}${e.note ? ` ${e.note}` : ''}`}
                                >
                                    <CategoryTag category={dailyCategory(e.category)} />
                                    <span className={styles.itemMain}>
                                        <span className={styles.itemCat}>{e.category}</span>
                                        {e.note && <span className={styles.itemNote}>{e.note}</span>}
                                    </span>
                                    <span className={cx(styles.itemAmt, 'num')}>−{fmt(e.amount)}</span>
                                </button>
                                <button className={styles.deleteBtn} onClick={() => handleDelete(e)} aria-label="Delete">✕</button>
                            </div>
                        ))}
                    </section>
                ))}
            </div>

            {!problem && data?.nextCursor && (
                <button className={styles.moreBtn} onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? 'LOADING…' : `LOAD ${Math.min(PAGE_SIZE, left)} MORE · ${left} LEFT`}
                </button>
            )}
            {data && count > 0 && !data.nextCursor && (
                <div className={styles.endNote}>
                    {count > PAGE_SIZE && `ALL ${count} SHOWN · `}THAT&apos;S EVERYTHING
                </div>
            )}
        </div>
    );
}
