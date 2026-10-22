'use client';

import { useState, useEffect, useRef } from 'react';
import type { BudgetRow, CategoryBudget, FixedRow } from '@/services/budgets';
import cx from 'classnames';
import {
    INCOME_CATEGORIES, FIXED_CATEGORIES, DAILY_CATEGORIES, incomeCategory, fixedCategory, type Category,
} from '@/common/constants/categories';
import { useExpense } from '@/context/ExpenseContext';
import { useToast } from '@/context/ToastContext';
import { useNavigationGuard } from '@/context/NavigationGuardContext';
import CategoryTag from '@/common/components/CategoryTag';
import SegmentBar from '@/common/components/SegmentBar';
import LimitBar from '@/common/components/LimitBar';
import { fmt, fmtSigned, fmtMonth, todayInt } from '@/lib/format';
import { budgetProgress, type CategoryProgress } from '@/lib/budgetProgress';
import { billTotals, dueDate } from '@/lib/bills';
import styles from './MonthlyBudget.module.css';

type Row = { id: string; label: string; amount: string; category: string; dueDay: string; paid: boolean };
type VarEntry = { category: string; total: number };
type Section = 'income' | 'fixed';
type Source = { kind: 'saved' } | { kind: 'copied'; year: number; month: number } | { kind: 'template' };

function uid() { return Math.random().toString(36).slice(2, 9); }

function row(label: string, category: string): Row {
    return { id: uid(), label, amount: '0.00', category, dueDay: '', paid: false };
}

function makeIncomeDefaults(): Row[] {
    return [
        row('Salary', 'Employment'), row('Commissions', 'Employment'), row('Bonuses', 'Employment'),
        row('Dividends', 'Investment'), row('Rental Income', 'Investment'), row('Interest Income', 'Investment'),
        row('Misc', 'Other'),
    ];
}

function makeExpenseDefaults(): Row[] {
    return [
        row('Utilities & Bills', 'Housing'), row('Taxes', 'Tax'), row('Insurance', 'Insurance'),
        row('School', 'Education'), row('Family', 'Family'), row('Misc', 'Other'),
    ];
}

function toRows(list: (BudgetRow | FixedRow)[]): Row[] {
    return list.map(r => ({
        id: r.id || uid(),
        label: r.label ?? '',
        category: r.category,
        amount: (Number(r.amount) || 0).toFixed(2),
        dueDay: 'dueDay' in r && r.dueDay ? String(r.dueDay) : '',
        paid: 'paid' in r && r.paid === true,
    }));
}

function toLimits(list: CategoryBudget[] | undefined): Record<string, string> {
    return Object.fromEntries((list ?? []).map(l => [l.category, l.amount.toFixed(2)]));
}

const sum = (rows: Row[]) => rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

export default function MonthlyBudgetPage() {
    const now = new Date();
    const today = todayInt();
    const { version } = useExpense();
    const toast = useToast();
    const { setGuard } = useNavigationGuard();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [income, setIncome] = useState<Row[]>([]);
    const [fixed, setFixed] = useState<Row[]>([]);
    // Monthly limit per daily category, as typed ('' = no limit)
    const [limits, setLimits] = useState<Record<string, string>>({});
    const [suggested, setSuggested] = useState<Record<string, number>>({});
    // Fixed rows that exist in the saved plan, so a paid tick can be saved on its own
    const [savedRowIds, setSavedRowIds] = useState<Set<string>>(new Set());
    const [source, setSource] = useState<Source>({ kind: 'template' });
    const [variable, setVariable] = useState<VarEntry[]>([]);
    const [loadedKey, setLoadedKey] = useState('');
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [openDrop, setOpenDrop] = useState<string | null>(null);
    const [pending, setPending] = useState<{ year: number; month: number } | null>(null);
    // Set when the user tries to leave the page with unsaved edits; calling it leaves
    const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
    const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const key = `${year}-${month}`;
    const loading = loadedKey !== key;

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            fetch(`/api/budget/${year}/${month}`).then(r => r.ok ? r.json() : null),
            fetch(`/api/daily-log/month/${year}/${month}`).then(r => r.ok ? r.json() : []),
            fetch(`/api/budget/${year}/${month}/suggestions`).then(r => r.ok ? r.json() : { suggestions: [] }),
        ]).then(([data, varData, sug]) => {
            if (cancelled) return;
            const hasRows = data && ((data.income?.length ?? 0) + (data.fixedExpenses?.length ?? 0)) > 0;
            if (hasRows) {
                setIncome(data.income?.length ? toRows(data.income) : makeIncomeDefaults());
                setFixed(data.fixedExpenses?.length ? toRows(data.fixedExpenses) : makeExpenseDefaults());
                setSource(data.source === 'copied' && data.copiedFrom
                    ? { kind: 'copied', year: data.copiedFrom.year, month: data.copiedFrom.month }
                    : { kind: 'saved' });
            } else {
                setIncome(makeIncomeDefaults());
                setFixed(makeExpenseDefaults());
                setSource(data ? { kind: 'saved' } : { kind: 'template' });
            }
            setLimits(toLimits(data?.categoryBudgets));
            setSavedRowIds(new Set(data?.source === 'saved' ? (data.fixedExpenses ?? []).map((r: FixedRow) => r.id) : []));
            setSuggested(Object.fromEntries((sug.suggestions ?? []).map((s: { category: string; amount: number }) => [s.category, s.amount])));
            setVariable(Array.isArray(varData) ? varData : []);
            setDirty(false);
            setSaving('idle');
            setOpenDrop(null);
            setLoadedKey(`${year}-${month}`);
        });
        return () => { cancelled = true; };
    }, [year, month]);

    // An expense added from the shell only changes the daily spending,
    // so refresh just that and keep any unsaved row edits
    const monthRef = useRef({ year, month });
    useEffect(() => { monthRef.current = { year, month }; }, [year, month]);
    useEffect(() => {
        if (version === 0) return;
        const { year: y, month: m } = monthRef.current;
        fetch(`/api/daily-log/month/${y}/${m}`)
            .then(r => r.ok ? r.json() : [])
            .then(v => Array.isArray(v) && setVariable(v));
    }, [version]);

    useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

    // Unsaved edits: ask before leaving the page in-app, and let the browser warn on close/reload
    useEffect(() => {
        if (!dirty) return;
        setGuard(proceed => { setPending(null); setPendingLeave(() => proceed); });
        function onBeforeUnload(e: BeforeUnloadEvent) {
            e.preventDefault();
            e.returnValue = '';
        }
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => {
            setGuard(null);
            window.removeEventListener('beforeunload', onBeforeUnload);
        };
    }, [dirty, setGuard]);

    function discardAndLeave() {
        const proceed = pendingLeave;
        setPendingLeave(null);
        setGuard(null);
        proceed?.();
    }

    function goTo(y: number, m: number) {
        setYear(y);
        setMonth(m);
        setPending(null);
    }

    function step(delta: number) {
        const d = new Date(year, month - 1 + delta, 1);
        const target = { year: d.getFullYear(), month: d.getMonth() + 1 };
        if (dirty) { setPendingLeave(null); setPending(target); }
        else goTo(target.year, target.month);
    }

    function setter(sec: Section) {
        return sec === 'income' ? setIncome : setFixed;
    }

    function markDirty() {
        setDirty(true);
        setSaving('idle');
    }

    function edit(sec: Section, id: string, patch: Partial<Row>) {
        setter(sec)(rows => rows.map(r => r.id === id ? { ...r, ...patch } : r));
        markDirty();
    }

    function addRow(sec: Section) {
        setter(sec)(rows => [...rows, row('', sec === 'income' ? 'Employment' : 'Housing')]);
        markDirty();
    }

    function removeRow(sec: Section, id: string) {
        setter(sec)(rows => rows.filter(r => r.id !== id));
        markDirty();
    }

    function editLimit(category: string, value: string) {
        setLimits(l => ({ ...l, [category]: value }));
        markDirty();
    }

    /** Fills the categories that have no limit yet with last 3 months' average */
    function suggest() {
        const fill = DAILY_CATEGORIES.filter(c => !limits[c.id] && suggested[c.id]);
        if (fill.length === 0) {
            toast(Object.keys(suggested).length ? 'EVERY CATEGORY WITH SPENDING HAS A LIMIT' : 'NO SPENDING IN THE LAST 3 MONTHS TO GO BY');
            return;
        }
        setLimits(l => ({ ...l, ...Object.fromEntries(fill.map(c => [c.id, suggested[c.id].toFixed(2)])) }));
        markDirty();
        toast(`FILLED ${fill.length} ${fill.length === 1 ? 'LIMIT' : 'LIMITS'} FROM YOUR SPENDING`);
    }

    /**
     * A bill already in the saved plan is ticked straight away. Anything else (a new row, or a month
     * that's only a copy) becomes an unsaved change that SAVE MONTH stores.
     */
    async function togglePaid(r: Row) {
        const paid = !r.paid;
        setFixed(rows => rows.map(x => x.id === r.id ? { ...x, paid } : x));
        if (source.kind !== 'saved' || !savedRowIds.has(r.id)) {
            markDirty();
            return;
        }
        const res = await fetch(`/api/budget/${year}/${month}/bills/${r.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paid }),
        }).catch(() => null);
        if (!res?.ok) {
            setFixed(rows => rows.map(x => x.id === r.id ? { ...x, paid: !paid } : x));
            toast('COULD NOT UPDATE THE BILL · TRY AGAIN');
        }
    }

    async function handleSave() {
        if (saving === 'saving') return;
        setSaving('saving');
        // Row ids are kept so the server can track a row across saves (bills need this)
        const strip = (rows: Row[]) => rows.map(r => ({ id: r.id, label: r.label, category: r.category, amount: parseFloat(r.amount) || 0 }));
        const body = {
            income: strip(income),
            fixedExpenses: fixed.map(r => ({ ...strip([r])[0], dueDay: r.dueDay ? Number(r.dueDay) : null, paid: r.paid })),
            categoryBudgets: Object.entries(limits)
                .filter(([, v]) => v !== '' && Number.isFinite(parseFloat(v)))
                .map(([category, v]) => ({ category, amount: parseFloat(v) })),
        };
        try {
            const res = await fetch(`/api/budget/${year}/${month}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error();
            setDirty(false);
            setSource({ kind: 'saved' });
            setSavedRowIds(new Set(fixed.map(r => r.id)));
            setSaving('saved');
            if (savedTimer.current) clearTimeout(savedTimer.current);
            savedTimer.current = setTimeout(() => setSaving('idle'), 3000);
        } catch {
            setSaving('idle');
            toast('COULD NOT SAVE · TRY AGAIN');
        }
    }

    const totalIncome = sum(income);
    const totalFixed = sum(fixed);
    const totalVariable = variable.reduce((s, v) => s + v.total, 0);
    const totalExpenses = totalFixed + totalVariable;
    const net = totalIncome - totalExpenses;
    const rate = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : null;
    const label = fmtMonth(year, month);
    const isCurrentMonth = Math.floor(today / 100) === year * 100 + month;

    const spentByCategory = Object.fromEntries(variable.map(v => [v.category, v.total]));
    const limitList = Object.entries(limits)
        .filter(([, v]) => v !== '' && Number.isFinite(parseFloat(v)))
        .map(([category, v]) => ({ category, amount: parseFloat(v) }));
    const progress = limitList.length ? budgetProgress(limitList, spentByCategory, year, month, today) : null;
    const byCategory = new Map<string, CategoryProgress>(progress?.byCategory.map(c => [c.category, c]) ?? []);

    const bills = billTotals(
        fixed.map(r => ({ id: r.id, label: r.label, category: r.category, amount: parseFloat(r.amount) || 0, dueDay: r.dueDay ? Number(r.dueDay) : null, paid: r.paid })),
        year, month, today,
    );

    /** 'overdue' (due, not paid, this month), 'today', or null */
    function billState(r: Row): 'overdue' | 'today' | null {
        if (!isCurrentMonth || !r.dueDay) return null;
        const due = dueDate(year, month, Number(r.dueDay));
        if (due === today) return r.paid ? null : 'today';
        return due < today && !r.paid ? 'overdue' : null;
    }

    const status = source.kind === 'saved'
        ? { text: 'SAVED MONTH', color: 'var(--pos)' }
        : source.kind === 'copied'
            ? { text: `COPIED FROM ${fmtMonth(source.year, source.month)} · NOT SAVED`, color: 'var(--primary)' }
            : { text: 'STARTER TEMPLATE · NOT SAVED', color: 'var(--primary)' };

    function renderCategoryPill(sec: Section, r: Row, options: Category[], find: (id: string) => Category) {
        const c = find(r.category);
        const open = openDrop === r.id;
        return (
            <>
                <button className={cx(styles.pill, open && styles.pillOpen)} onClick={() => setOpenDrop(open ? null : r.id)} aria-label={`Category: ${c.id}`}>
                    <span className={styles.swatch} style={{ background: c.color }} />
                    {c.code}
                    <span className={styles.pillCaret} aria-hidden="true" />
                </button>
                {open && (
                    <>
                        <div className={styles.dropOverlay} onClick={() => setOpenDrop(null)} />
                        <div className={styles.drop}>
                            {options.map(o => (
                                <button
                                    key={o.id}
                                    className={cx(styles.dropOption, o.id === r.category && styles.dropOptionActive)}
                                    onClick={() => { edit(sec, r.id, { category: o.id }); setOpenDrop(null); }}
                                >
                                    <span className={styles.swatch} style={{ background: o.color }} />
                                    <span className={styles.dropCode}>{o.code}</span>
                                    {o.id}
                                    <span className={styles.dropCheck}>{o.id === r.category ? '✓' : ''}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </>
        );
    }

    function renderAmount(sec: Section, r: Row) {
        return (
            <span className={styles.amountCell}>
                $
                <input
                    className={cx(styles.amountInput, !parseFloat(r.amount) && styles.amountZero)}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label={`${r.label || 'Row'} amount`}
                    value={r.amount}
                    onChange={e => edit(sec, r.id, { amount: e.target.value.replace(/[^0-9.]/g, '') })}
                    onBlur={() => setter(sec)(list => list.map(x => x.id === r.id ? { ...x, amount: (parseFloat(x.amount) || 0).toFixed(2) } : x))}
                />
            </span>
        );
    }

    function renderLabel(sec: Section, r: Row) {
        return (
            <input
                className={styles.labelInput}
                placeholder="Label"
                value={r.label}
                onChange={e => edit(sec, r.id, { label: e.target.value })}
            />
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.sticky}>
                <div className={styles.toolbar}>
                    <button className={styles.navBtn} onClick={() => step(-1)} aria-label="Previous month">‹</button>
                    <span className={styles.monthLabel}>{label}</span>
                    <button className={styles.navBtn} onClick={() => step(1)} aria-label="Next month">›</button>
                    <span className={cx(styles.status, styles.desktopOnly)} style={{ color: status.color }}>
                        <span className={styles.dot} style={{ background: status.color }} />{status.text}
                    </span>
                    {dirty && <span className={cx(styles.unsaved, styles.desktopOnly)}>· UNSAVED CHANGES</span>}
                    <button
                        className={cx(styles.saveBtn, saving === 'saving' && styles.saveBusy, saving === 'saved' && styles.saveDone)}
                        onClick={handleSave}
                        disabled={saving === 'saving' || loading}
                    >
                        {saving === 'saving' ? 'SAVING…' : saving === 'saved' ? '✓ SAVED' : 'SAVE MONTH'}
                    </button>
                </div>
                <div className={cx(styles.statusLine, styles.phoneOnly)} style={{ color: status.color }}>
                    <span className={styles.dot} style={{ background: status.color }} />{status.text}
                    {dirty && <span className={styles.unsavedShort}>· UNSAVED</span>}
                </div>
                {pending && (
                    <div className={styles.confirm}>
                        <span className={styles.confirmText}>You have unsaved changes in {label}. Switching month will discard them.</span>
                        <button className={styles.confirmBtn} onClick={() => setPending(null)}>STAY</button>
                        <button className={cx(styles.confirmBtn, styles.confirmDiscard)} onClick={() => goTo(pending.year, pending.month)}>
                            DISCARD &amp; SWITCH
                        </button>
                    </div>
                )}
                {pendingLeave && (
                    <div className={styles.confirm} role="alertdialog" aria-label="Unsaved changes">
                        <span className={styles.confirmText}>You have unsaved changes in {label}. Leaving this page will discard them.</span>
                        <button className={styles.confirmBtn} onClick={() => setPendingLeave(null)}>STAY</button>
                        <button className={cx(styles.confirmBtn, styles.confirmDiscard)} onClick={discardAndLeave}>
                            DISCARD &amp; LEAVE
                        </button>
                    </div>
                )}
                <div className={styles.summary}>
                    <div className={styles.sumCell}>
                        <span className={styles.sumLabel}>INCOME</span>
                        <span className={cx(styles.sumValue, 'num')} style={{ color: 'var(--income)' }}>{fmt(totalIncome)}</span>
                    </div>
                    <div className={styles.sumCell}>
                        <span className={styles.sumLabel}>EXPENSES</span>
                        <span className={cx(styles.sumValue, 'num')} style={{ color: 'var(--expense)' }}>{fmt(totalExpenses)}</span>
                    </div>
                    <div className={styles.sumCell}>
                        <span className={styles.sumLabel}>NET{rate !== null && ` · ${rate}%`}</span>
                        <span
                            className={cx(styles.sumValue, 'num')}
                            style={{ color: net < 0 ? 'var(--neg)' : net > 0 ? 'var(--pos)' : 'var(--muted)' }}
                        >
                            {fmtSigned(net)}
                        </span>
                    </div>
                    <div className={cx(styles.sumCell, styles.sumWide)} data-testid="sum-left">
                        <span className={styles.sumLabel}>
                            LEFT TO SPEND{progress?.dailyAllowance != null && ` · ${fmt(progress.dailyAllowance)}/DAY`}
                        </span>
                        <span className={cx(styles.sumValue, 'num')} style={{ color: progress && progress.left < 0 ? 'var(--neg)' : undefined }}>
                            {progress ? fmt(progress.left) : <span className={styles.dimText}>NO LIMITS</span>}
                        </span>
                    </div>
                    <div className={cx(styles.sumCell, styles.sumWide)} data-testid="sum-bills">
                        <span className={styles.sumLabel}>BILLS LEFT TO PAY</span>
                        <span className={cx(styles.sumValue, 'num')} style={{ color: bills.leftToPay > 0 ? 'var(--neg)' : 'var(--pos)' }}>
                            {fmt(bills.leftToPay)}
                        </span>
                    </div>
                </div>
            </div>

            <div className={cx(styles.body, loading && styles.dim)}>
                <div className={styles.sections}>
                    <section className={styles.section}>
                        <div className={styles.sectionHead}>
                            <span className={styles.sectionTitle}>INCOME <span className={styles.dimText}>· {income.length} ROWS</span></span>
                            <span className="num" style={{ color: 'var(--income)' }}>{fmt(totalIncome)}</span>
                        </div>
                        {income.map(r => (
                            <div key={r.id} className={styles.row}>
                                {renderCategoryPill('income', r, INCOME_CATEGORIES, incomeCategory)}
                                {renderLabel('income', r)}
                                {renderAmount('income', r)}
                                <button className={styles.removeBtn} onClick={() => removeRow('income', r.id)} aria-label="Remove row">✕</button>
                            </div>
                        ))}
                        <button className={styles.addRowBtn} onClick={() => addRow('income')}>+ ADD INCOME ROW</button>
                    </section>

                    <section className={styles.section} aria-label="Fixed and bills">
                        <div className={styles.sectionHead}>
                            <span className={styles.sectionTitle}>FIXED &amp; BILLS <span className={styles.dimText}>· {fixed.length} ROWS</span></span>
                            <span className="num" style={{ color: 'var(--expense)' }}>{fmt(totalFixed)}</span>
                        </div>
                        <div className={cx(styles.fixedRow, styles.colHead)} aria-hidden="true">
                            <span>CAT</span><span>LABEL</span><span className={styles.center}>DUE</span>
                            <span className={styles.right}>AMOUNT</span><span className={styles.center}>PAID</span><span />
                        </div>
                        {fixed.map(r => {
                            const state = billState(r);
                            return (
                                <div key={r.id} className={cx(styles.row, styles.fixedRow, state === 'overdue' && styles.overdueRow)} data-testid="fixed-row">
                                    {renderCategoryPill('fixed', r, FIXED_CATEGORIES, fixedCategory)}
                                    {renderLabel('fixed', r)}
                                    <input
                                        className={cx(styles.dueInput, state && styles.dueAlert, r.paid && styles.duePaid)}
                                        inputMode="numeric"
                                        maxLength={2}
                                        placeholder="–"
                                        aria-label={`${r.label || 'Row'} due day`}
                                        title="Day of the month it's due (1–31)"
                                        value={r.dueDay}
                                        onChange={e => edit('fixed', r.id, { dueDay: e.target.value.replace(/\D/g, '') })}
                                        onBlur={() => setFixed(list => list.map(x => {
                                            if (x.id !== r.id || !x.dueDay) return x;
                                            const d = Number(x.dueDay);
                                            return { ...x, dueDay: d >= 1 ? String(Math.min(31, d)) : '' };
                                        }))}
                                    />
                                    {renderAmount('fixed', r)}
                                    <span className={styles.paidCell}>
                                        <input
                                            type="checkbox"
                                            className={cx(styles.paidBox, state === 'overdue' && styles.paidBoxAlert)}
                                            checked={r.paid}
                                            onChange={() => togglePaid(r)}
                                            aria-label={`${r.label || 'Bill'} paid`}
                                        />
                                    </span>
                                    <button className={styles.removeBtn} onClick={() => removeRow('fixed', r.id)} aria-label="Remove row">✕</button>
                                </div>
                            );
                        })}
                        <button className={styles.addRowBtn} onClick={() => addRow('fixed')}>+ ADD FIXED ROW</button>
                        <div className={styles.billsFoot} data-testid="bills-foot">
                            <span>LEFT TO PAY <b className="num">{fmt(bills.leftToPay)}</b></span>
                            <span>PAID <b className="num" style={{ color: 'var(--pos)' }}>{fmt(bills.paid)}</b></span>
                            {bills.overdueCount > 0 && <span style={{ color: 'var(--neg)' }}>{bills.overdueCount} OVERDUE</span>}
                        </div>
                    </section>
                </div>

                <section className={styles.limits} aria-label="Category limits">
                    <div className={styles.sectionHead}>
                        <span className={styles.sectionTitle}>
                            CATEGORY LIMITS <span className={styles.dimText}>· SPENT IS PULLED FROM DAILY LOG</span>
                        </span>
                        <button className={styles.suggestBtn} onClick={suggest}>↺ SUGGEST FROM MY SPENDING</button>
                    </div>
                    {progress ? (
                        <div className={styles.leftHead}>
                            <div className={styles.leftLine}>
                                <span className={cx(styles.leftBig, 'num')} style={{ color: progress.left < 0 ? 'var(--neg)' : undefined }}>
                                    {progress.left < 0 ? `$${fmt(-progress.left)} over budget` : `$${fmt(progress.left)} left to spend`}
                                </span>
                                <span className={styles.leftMeta}>
                                    {fmt(progress.spent)} SPENT OF {fmt(progress.totalLimit)}
                                    {progress.dailyAllowance != null && progress.timing === 'current' && ` · $${fmt(progress.dailyAllowance)}/DAY FOR ${progress.daysLeft} ${progress.daysLeft === 1 ? 'DAY' : 'DAYS'}`}
                                    {progress.unbudgetedSpent > 0 && ` · ${fmt(progress.unbudgetedSpent)} UNBUDGETED`}
                                </span>
                            </div>
                            <SegmentBar
                                segments={40}
                                rate={progress.totalLimit > 0 ? Math.min(100, (progress.spent / progress.totalLimit) * 100) : 100}
                                color={progress.left < 0 ? 'var(--neg)' : progress.spent >= progress.totalLimit * 0.8 ? 'var(--primary)' : 'var(--soft)'}
                            />
                        </div>
                    ) : (
                        <div className={styles.limitsEmpty}>
                            Set a monthly limit for the categories you want to keep an eye on, and see what&apos;s left to spend each day.
                        </div>
                    )}
                    {DAILY_CATEGORIES.map(c => {
                        const p = byCategory.get(c.id) ?? null;
                        const spent = spentByCategory[c.id] ?? 0;
                        const avg = suggested[c.id];
                        return (
                            <div key={c.id} className={styles.limitRow} data-testid="limit-row">
                                <span className={styles.limitName}><CategoryTag category={c} />{c.id}</span>
                                <span className={cx(styles.amountCell, styles.limitInput)}>
                                    $
                                    <input
                                        className={styles.amountInput}
                                        inputMode="decimal"
                                        placeholder={avg ? `avg ${Math.round(avg)}` : '–'}
                                        aria-label={`${c.id} limit`}
                                        value={limits[c.id] ?? ''}
                                        onChange={e => editLimit(c.id, e.target.value.replace(/[^0-9.]/g, ''))}
                                        onBlur={() => setLimits(l => l[c.id] ? { ...l, [c.id]: (parseFloat(l[c.id]) || 0).toFixed(2) } : l)}
                                    />
                                </span>
                                <span className={styles.limitBar}><LimitBar progress={p} color={c.color} /></span>
                                <span className={cx(styles.limitSpent, 'num')}>{spent ? fmt(spent) : '0'}</span>
                                <span
                                    className={cx(styles.limitStatus, 'num')}
                                    style={{ color: p?.status === 'over' ? 'var(--neg)' : p?.status === 'warning' ? 'var(--primary)' : undefined }}
                                >
                                    {p ? (p.left < 0 ? `OVER BY ${fmt(-p.left)}` : `${fmt(p.left)} LEFT`) : spent ? 'NO LIMIT' : '–'}
                                </span>
                            </div>
                        );
                    })}
                    <div className={styles.totalRow}>
                        <span className={styles.totalLabel}>
                            TOTAL EXPENSES <span className={styles.dimText}>· FIXED {fmt(totalFixed)} + DAILY {fmt(totalVariable)}</span>
                        </span>
                        <span className="num" style={{ color: 'var(--expense)' }}>{fmt(totalExpenses)}</span>
                    </div>
                </section>
            </div>
        </div>
    );
}
