'use client';

import { useState, useEffect, useRef } from 'react';
import cx from 'classnames';
import styles from './MonthlyBudget.module.css';
import Payments from '@/common/icons/Payments';
import Bank from '@/common/icons/Bank';
import DailyLog from '@/common/icons/DailyLog';
import Trash from '@/common/icons/Trash';
import OthersGrid from '@/common/icons/OthersGrid';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/common/constants/categories';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const INCOME_CATEGORIES = ['Employment', 'Investment', 'Business', 'Other'] as const;
const EXPENSE_CATEGORIES = ['Housing', 'Tax', 'Insurance', 'Education', 'Family', 'Other'] as const;

type IncomeRow = { id: string; label: string; amount: string; category: string };
type FixedRow = { id: string; label: string; amount: string; category: string };
type VarEntry = { category: string; total: number };

function makeIncomeDefaults(): IncomeRow[] {
    return [
        { id: uid(), label: 'Salary', amount: '', category: 'Employment' },
        { id: uid(), label: 'Commissions', amount: '', category: 'Employment' },
        { id: uid(), label: 'Bonuses', amount: '', category: 'Employment' },
        { id: uid(), label: 'Dividends', amount: '', category: 'Investment' },
        { id: uid(), label: 'Rental Income', amount: '', category: 'Investment' },
        { id: uid(), label: 'Interest Income', amount: '', category: 'Investment' },
        { id: uid(), label: 'Misc', amount: '', category: 'Other' },
    ];
}

function makeExpenseDefaults(): FixedRow[] {
    return [
        { id: uid(), label: 'Utilities & Bills', amount: '', category: 'Housing' },
        { id: uid(), label: 'Taxes', amount: '', category: 'Tax' },
        { id: uid(), label: 'Insurance', amount: '', category: 'Insurance' },
        { id: uid(), label: 'School', amount: '', category: 'Education' },
        { id: uid(), label: 'Family', amount: '', category: 'Family' },
        { id: uid(), label: 'Misc', amount: '', category: 'Other' },
    ];
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function blockInvalidNumericKeys(e: React.KeyboardEvent<HTMLInputElement>) {
    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
}

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MonthlyBudgetPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [income, setIncome] = useState<IncomeRow[]>(makeIncomeDefaults());
    const [fixed, setFixed] = useState<FixedRow[]>(makeExpenseDefaults());
    const [loading, setLoading] = useState(true);
    const [variableExpenses, setVariableExpenses] = useState<VarEntry[]>([]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerYear, setPickerYear] = useState(year);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!openCategoryId) return;
        function handleClick(e: MouseEvent) {
            if (!(e.target as Element).closest('[data-cat-drop]')) {
                setOpenCategoryId(null);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [openCategoryId]);

    useEffect(() => {
        if (!pickerOpen) return;
        setPickerYear(year);
        function handleClick(e: MouseEvent) {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setPickerOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [pickerOpen, year]);

    useEffect(() => {
        setLoading(true);
        setSaved(false);
        Promise.all([
            fetch(`/api/budget/${year}/${month}`).then(r => r.ok ? r.json() : null),
            fetch(`/api/daily-log/month/${year}/${month}`).then(r => r.ok ? r.json() : []),
        ]).then(([data, varData]) => {
            if (data) {
                if (Array.isArray(data.income) && data.income.length > 0) {
                    setIncome(data.income.map((r: any) => ({ ...r, id: uid(), amount: r.amount != null ? String(r.amount) : '' })));
                } else {
                    setIncome(makeIncomeDefaults());
                }
                if (Array.isArray(data.fixedExpenses) && data.fixedExpenses.length > 0) {
                    setFixed(data.fixedExpenses.map((r: any) => ({ ...r, id: uid(), amount: r.amount != null ? String(r.amount) : '' })));
                } else {
                    setFixed(makeExpenseDefaults());
                }
            } else {
                setIncome(makeIncomeDefaults());
                setFixed(makeExpenseDefaults());
            }
            setVariableExpenses(Array.isArray(varData) ? varData : []);
        }).finally(() => setLoading(false));
    }, [year, month]);

    function prevMonth() {
        if (month === 1) { setYear(y => y - 1); setMonth(12); }
        else setMonth(m => m - 1);
    }

    function nextMonth() {
        if (month === 12) { setYear(y => y + 1); setMonth(1); }
        else setMonth(m => m + 1);
    }

    function addIncomeRow() {
        setIncome(prev => [...prev, { id: uid(), label: '', amount: '', category: 'Other' }]);
    }
    function updateIncome(id: string, patch: Partial<IncomeRow>) {
        setIncome(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    }
    function deleteIncomeRow(id: string) {
        setIncome(prev => prev.filter(r => r.id !== id));
    }

    function addFixedRow() {
        setFixed(prev => [...prev, { id: uid(), label: '', amount: '', category: 'Other' }]);
    }
    function updateFixed(id: string, patch: Partial<FixedRow>) {
        setFixed(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    }
    function deleteFixedRow(id: string) {
        setFixed(prev => prev.filter(r => r.id !== id));
    }

    const totalIncome = income.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalFixed = fixed.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalVariable = variableExpenses.reduce((s, r) => s + r.total, 0);
    const totalExpenses = totalFixed + totalVariable;
    const netSavings = totalIncome - totalExpenses;
    const savingsPercent = totalIncome > 0
        ? Math.max(0, Math.min(100, Math.round((netSavings / totalIncome) * 100)))
        : 0;

    async function handleSave() {
        setSaving(true);
        try {
            const res = await fetch(`/api/budget/${year}/${month}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    income: income.map(({ id: _id, ...r }) => ({ ...r, amount: parseFloat(r.amount) || 0 })),
                    fixedExpenses: fixed.map(({ id: _id, ...r }) => ({ label: r.label, category: r.category, amount: parseFloat(r.amount) || 0 })),
                }),
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } finally {
            setSaving(false);
        }
    }

    function renderCategoryPill(rowId: string, current: string, options: readonly string[], onSelect: (c: string) => void) {
        return (
            <div className={styles.categoryWrap} data-cat-drop="true">
                <button
                    className={cx(styles.categoryPill, openCategoryId === rowId && styles.categoryPillOpen)}
                    onClick={() => setOpenCategoryId(openCategoryId === rowId ? null : rowId)}
                >
                    {current}
                </button>
                {openCategoryId === rowId && (
                    <div className={styles.categoryDropdown}>
                        {options.map(c => (
                            <button
                                key={c}
                                className={cx(styles.categoryOption, current === c && styles.categoryOptionActive)}
                                onClick={() => { onSelect(c); setOpenCategoryId(null); }}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className="pageTitle">Budget Planner</h1>
                    <p className="pageSubtitle">Plan your expected income and fixed expenses.</p>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.monthNavWrap} ref={pickerRef}>
                        <div className={styles.monthNav}>
                            <button className={styles.monthNavBtn} onClick={prevMonth}>&#8249;</button>
                            <button className={styles.monthLabel} onClick={() => setPickerOpen(o => !o)}>
                                {MONTHS[month - 1]} {year}
                            </button>
                            <button className={styles.monthNavBtn} onClick={nextMonth}>&#8250;</button>
                        </div>
                        {pickerOpen && (
                            <div className={styles.picker}>
                                <div className={styles.pickerYearRow}>
                                    <button className={styles.pickerYearBtn} onClick={() => setPickerYear(y => y - 1)}>&#8249;</button>
                                    <span className={styles.pickerYear}>{pickerYear}</span>
                                    <button className={styles.pickerYearBtn} onClick={() => setPickerYear(y => y + 1)}>&#8250;</button>
                                </div>
                                <div className={styles.pickerGrid}>
                                    {MONTHS.map((m, i) => (
                                        <button
                                            key={m}
                                            className={cx(
                                                styles.pickerMonth,
                                                pickerYear === year && i + 1 === month && styles.pickerMonthActive
                                            )}
                                            onClick={() => { setYear(pickerYear); setMonth(i + 1); setPickerOpen(false); }}
                                        >
                                            {m.slice(0, 3)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        className={cx(styles.saveBtn, saved && styles.saveBtnSaved)}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Month'}
                    </button>
                </div>
            </div>

            {loading ? (
                <p className={styles.loading}>Loading...</p>
            ) : (
                <div className={styles.grid}>
                    {/* Income */}
                    <section className={styles.card}>
                        <h2 className={styles.sectionTitleIncome}>
                            <Payments className={styles.sectionIcon} />
                            Income
                        </h2>
                        <div className={styles.rows}>
                            {income.map(row => (
                                <div key={row.id} className={styles.row}>
                                    <div className={styles.rowMain}>
                                        {renderCategoryPill(row.id, row.category, INCOME_CATEGORIES, c => updateIncome(row.id, { category: c }))}
                                        <input
                                            className={styles.labelInput}
                                            type="text"
                                            placeholder="Label"
                                            value={row.label}
                                            onChange={e => updateIncome(row.id, { label: e.target.value })}
                                        />
                                    </div>
                                    <div className={styles.rowActions}>
                                        <div className={styles.inputWrap}>
                                            <span className={styles.currency}>$</span>
                                            <input
                                                className={styles.input}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={row.amount}
                                                onKeyDown={blockInvalidNumericKeys}
                                                onChange={e => updateIncome(row.id, { amount: e.target.value })}
                                            />
                                        </div>
                                        <button className={styles.deleteBtn} onClick={() => deleteIncomeRow(row.id)} title="Remove">
                                            <Trash />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className={styles.addRowBtn} onClick={addIncomeRow}>+ Add</button>
                        <div className={styles.totalRow}>
                            <span className={styles.totalLabel}>Total Income</span>
                            <span className={styles.totalIncome}>${fmt(totalIncome)}</span>
                        </div>
                    </section>

                    {/* Expenses */}
                    <div className={styles.expenseCol}>
                        <section className={styles.card}>
                            <h2 className={styles.sectionTitleFixed}>
                                <Bank className={styles.sectionIcon} />
                                Fixed Expenses
                            </h2>
                            <div className={styles.rows}>
                                {fixed.map(row => (
                                    <div key={row.id} className={styles.row}>
                                        <div className={styles.rowMain}>
                                            {renderCategoryPill(row.id, row.category, EXPENSE_CATEGORIES, c => updateFixed(row.id, { category: c }))}
                                            <input
                                                className={styles.labelInput}
                                                type="text"
                                                placeholder="Label"
                                                value={row.label}
                                                onChange={e => updateFixed(row.id, { label: e.target.value })}
                                            />
                                        </div>
                                        <div className={styles.rowActions}>
                                            <div className={styles.inputWrap}>
                                                <span className={styles.currency}>$</span>
                                                <input
                                                    className={styles.input}
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={row.amount}
                                                    onKeyDown={blockInvalidNumericKeys}
                                                    onChange={e => updateFixed(row.id, { amount: e.target.value })}
                                                />
                                            </div>
                                            <button className={styles.deleteBtn} onClick={() => deleteFixedRow(row.id)} title="Remove">
                                                <Trash />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button className={styles.addRowBtn} onClick={addFixedRow}>+ Add</button>
                        </section>

                        <section className={styles.card}>
                            <div className={styles.variableHeader}>
                                <h2 className={styles.sectionTitleVariable}>
                                    <DailyLog className={styles.sectionIcon} />
                                    Variable Expenses
                                </h2>
                                <span className={styles.badge}>Auto-pulled from Daily Log</span>
                            </div>
                            {variableExpenses.length === 0 ? (
                                <p className={styles.variableEmpty}>No daily log entries for this month yet.</p>
                            ) : (
                                <div className={styles.varRows}>
                                    {variableExpenses.map(({ category, total }) => {
                                        const Icon = CATEGORY_ICONS[category] ?? OthersGrid;
                                        const color = CATEGORY_COLORS[category] ?? '#6B7280';
                                        return (
                                            <div key={category} className={styles.varRow}>
                                                <div className={styles.varRowLeft}>
                                                    <span className={styles.varIconWrap} style={{ background: `${color}22` }}>
                                                        <Icon width="16" height="16" style={{ color }} />
                                                    </span>
                                                    <span className={styles.varCatName}>{category}</span>
                                                </div>
                                                <span className={styles.varAmt}>${fmt(total)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className={styles.totalRow}>
                                <span className={styles.totalLabel}>Total Expenses</span>
                                <span className={styles.totalExpense}>${fmt(totalExpenses)}</span>
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {/* Sticky summary bar */}
            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Total Income</span>
                    <span className={styles.summaryIncome}>${fmt(totalIncome)}</span>
                </div>
                <div className={styles.summaryDivider} />
                <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Total Expenses</span>
                    <span className={styles.summaryExpense}>${fmt(totalExpenses)}</span>
                </div>
                <div className={styles.summaryDivider} />
                <div className={cx(styles.summaryItem, styles.summaryNetBox)}>
                    <span className={styles.summaryLabel}>Net Savings</span>
                    <span className={cx(styles.summaryNet, netSavings >= 0 ? styles.positive : styles.negative)}>
                        {netSavings < 0 ? '-' : ''}${fmt(Math.abs(netSavings))}
                    </span>
                </div>
                <div className={styles.ringWrap}>
                    <svg viewBox="0 0 36 36" className={styles.ring}>
                        <path
                            className={styles.ringBg}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none" strokeDasharray="100,100"
                        />
                        <path
                            className={styles.ringFg}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            strokeDasharray={`${savingsPercent},100`}
                            strokeLinecap="round"
                        />
                    </svg>
                    <span className={styles.ringLabel}>{savingsPercent}%</span>
                </div>
            </div>
        </div>
    );
}
