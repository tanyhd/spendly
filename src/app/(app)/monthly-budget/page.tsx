'use client';

import { useState, useEffect, useRef } from 'react';
import type { BudgetRow } from '@/services/budgets';
import cx from 'classnames';
import {
    INCOME_CATEGORIES, FIXED_CATEGORIES, dailyCategory, incomeCategory, fixedCategory, type Category,
} from '@/common/constants/categories';
import { useExpense } from '@/context/ExpenseContext';
import { useToast } from '@/context/ToastContext';
import { useNavigationGuard } from '@/context/NavigationGuardContext';
import CategoryTag from '@/common/components/CategoryTag';
import SegmentBar from '@/common/components/SegmentBar';
import { fmt, fmtSigned, fmtMonth } from '@/lib/format';
import styles from './MonthlyBudget.module.css';

type Row = { id: string; label: string; amount: string; category: string };
type VarEntry = { category: string; total: number };
type Section = 'income' | 'fixed';
type Source = { kind: 'saved' } | { kind: 'copied'; year: number; month: number } | { kind: 'template' };

function uid() { return Math.random().toString(36).slice(2, 9); }

function makeIncomeDefaults(): Row[] {
    return [
        { id: uid(), label: 'Salary', amount: '0.00', category: 'Employment' },
        { id: uid(), label: 'Commissions', amount: '0.00', category: 'Employment' },
        { id: uid(), label: 'Bonuses', amount: '0.00', category: 'Employment' },
        { id: uid(), label: 'Dividends', amount: '0.00', category: 'Investment' },
        { id: uid(), label: 'Rental Income', amount: '0.00', category: 'Investment' },
        { id: uid(), label: 'Interest Income', amount: '0.00', category: 'Investment' },
        { id: uid(), label: 'Misc', amount: '0.00', category: 'Other' },
    ];
}

function makeExpenseDefaults(): Row[] {
    return [
        { id: uid(), label: 'Utilities & Bills', amount: '0.00', category: 'Housing' },
        { id: uid(), label: 'Taxes', amount: '0.00', category: 'Tax' },
        { id: uid(), label: 'Insurance', amount: '0.00', category: 'Insurance' },
        { id: uid(), label: 'School', amount: '0.00', category: 'Education' },
        { id: uid(), label: 'Family', amount: '0.00', category: 'Family' },
        { id: uid(), label: 'Misc', amount: '0.00', category: 'Other' },
    ];
}

function toRows(list: BudgetRow[]): Row[] {
    return list.map(r => ({ id: uid(), label: r.label ?? '', category: r.category, amount: (Number(r.amount) || 0).toFixed(2) }));
}

const sum = (rows: Row[]) => rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

export default function MonthlyBudgetPage() {
    const now = new Date();
    const { version } = useExpense();
    const toast = useToast();
    const { setGuard } = useNavigationGuard();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [income, setIncome] = useState<Row[]>([]);
    const [fixed, setFixed] = useState<Row[]>([]);
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
        ]).then(([data, varData]) => {
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
            setVariable(Array.isArray(varData) ? varData : []);
            setDirty(false);
            setSaving('idle');
            setOpenDrop(null);
            setLoadedKey(`${year}-${month}`);
        });
        return () => { cancelled = true; };
    }, [year, month]);

    // An expense added from the shell only changes the read-only variable list,
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

    function edit(sec: Section, id: string, patch: Partial<Row>) {
        setter(sec)(rows => rows.map(r => r.id === id ? { ...r, ...patch } : r));
        setDirty(true);
        setSaving('idle');
    }

    function addRow(sec: Section) {
        setter(sec)(rows => [...rows, { id: uid(), label: '', amount: '0.00', category: sec === 'income' ? 'Employment' : 'Housing' }]);
        setDirty(true);
    }

    function removeRow(sec: Section, id: string) {
        setter(sec)(rows => rows.filter(r => r.id !== id));
        setDirty(true);
    }

    async function handleSave() {
        if (saving === 'saving') return;
        setSaving('saving');
        const strip = (rows: Row[]) => rows.map(r => ({ label: r.label, category: r.category, amount: parseFloat(r.amount) || 0 }));
        try {
            const res = await fetch(`/api/budget/${year}/${month}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ income: strip(income), fixedExpenses: strip(fixed) }),
            });
            if (!res.ok) throw new Error();
            setDirty(false);
            setSource({ kind: 'saved' });
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
    const rate = totalIncome > 0 ? Math.max(0, Math.min(100, Math.round((net / totalIncome) * 100))) : null;
    const label = fmtMonth(year, month);

    const status = source.kind === 'saved'
        ? { text: 'SAVED MONTH', color: 'var(--pos)' }
        : source.kind === 'copied'
            ? { text: `COPIED FROM ${fmtMonth(source.year, source.month)} · NOT SAVED`, color: 'var(--primary)' }
            : { text: 'STARTER TEMPLATE · NOT SAVED', color: 'var(--primary)' };

    function renderSection(sec: Section, title: string, addLabel: string, rows: Row[], options: Category[], find: (id: string) => Category, total: number, color: string) {
        return (
            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <span className={styles.sectionTitle}>{title} <span className={styles.dimText}>· {rows.length} ROWS</span></span>
                    <span className="num" style={{ color }}>{fmt(total)}</span>
                </div>
                {rows.map(r => {
                    const c = find(r.category);
                    const open = openDrop === r.id;
                    return (
                        <div key={r.id} className={styles.row}>
                            <button className={cx(styles.pill, open && styles.pillOpen)} onClick={() => setOpenDrop(open ? null : r.id)}>
                                <span className={styles.swatch} style={{ background: c.color }} />
                                {c.code}
                                <span className={styles.pillCaret} aria-hidden="true" />
                            </button>
                            <input
                                className={styles.labelInput}
                                placeholder="Label"
                                value={r.label}
                                onChange={e => edit(sec, r.id, { label: e.target.value })}
                            />
                            <span className={styles.amountCell}>
                                $
                                <input
                                    className={cx(styles.amountInput, !parseFloat(r.amount) && styles.amountZero)}
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={r.amount}
                                    onChange={e => edit(sec, r.id, { amount: e.target.value.replace(/[^0-9.]/g, '') })}
                                    onBlur={() => setter(sec)(list => list.map(x => x.id === r.id ? { ...x, amount: (parseFloat(x.amount) || 0).toFixed(2) } : x))}
                                />
                            </span>
                            <button className={styles.removeBtn} onClick={() => removeRow(sec, r.id)} aria-label="Remove row">✕</button>
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
                        </div>
                    );
                })}
                <button className={styles.addRowBtn} onClick={() => addRow(sec)}>+ ADD {addLabel} ROW</button>
            </section>
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
                        <span className={styles.sumLabel}>NET SAVINGS</span>
                        <span
                            className={cx(styles.sumValue, 'num')}
                            style={{ color: net < 0 ? 'var(--neg)' : net > 0 ? 'var(--pos)' : 'var(--muted)' }}
                        >
                            {fmtSigned(net)}
                        </span>
                    </div>
                    <div className={cx(styles.sumCell, styles.rateCell)}>
                        <span className={styles.sumLabel}>SAVINGS RATE · {rate === null ? '—' : `${rate}%`}</span>
                        <SegmentBar rate={rate} />
                    </div>
                </div>
            </div>

            <div className={cx(styles.body, loading && styles.dim)}>
                <div className={styles.sections}>
                    {renderSection('income', 'INCOME', 'INCOME', income, INCOME_CATEGORIES, incomeCategory, totalIncome, 'var(--income)')}
                    {renderSection('fixed', 'FIXED EXPENSES', 'FIXED', fixed, FIXED_CATEGORIES, fixedCategory, totalFixed, 'var(--expense)')}
                </div>

                <div className={styles.variable}>
                    <div className={styles.sectionHead}>
                        <span className={styles.sectionTitle}>
                            VARIABLE <span className={styles.dimText}>· AUTO-PULLED FROM DAILY LOG · READ-ONLY</span>
                        </span>
                        <span className="num" style={{ color: 'var(--expense)' }}>{fmt(totalVariable)}</span>
                    </div>
                    {variable.length === 0 ? (
                        <div className={styles.varEmpty}>No daily log entries for this month yet.</div>
                    ) : variable.map(v => (
                        <div key={v.category} className={styles.varRow}>
                            <CategoryTag category={dailyCategory(v.category)} />
                            {v.category}
                            <span className={cx(styles.varAmt, 'num')}>{fmt(v.total)}</span>
                        </div>
                    ))}
                    <div className={styles.totalRow}>
                        <span className={styles.totalLabel}>TOTAL EXPENSES <span className={styles.dimText}>· FIXED + DAILY</span></span>
                        <span className="num" style={{ color: 'var(--expense)' }}>{fmt(totalExpenses)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
