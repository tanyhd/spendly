'use client';

import { useState, useEffect, useRef } from 'react';
import cx from 'classnames';
import styles from './MonthlyBudget.module.css';
import Payments from '@/common/icons/Payments';
import Bank from '@/common/icons/Bank';
import DailyLog from '@/common/icons/DailyLog';
import Recurring from '@/common/icons/Recurring';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const INCOME_FIELDS = [
    { key: 'salary', label: 'Salary' },
    { key: 'commissions', label: 'Commissions' },
    { key: 'bonuses', label: 'Bonuses' },
    { key: 'dividends', label: 'Dividends' },
    { key: 'rentalIncome', label: 'Rental Income' },
    { key: 'interestIncome', label: 'Interest Income' },
    { key: 'misc', label: 'Misc' },
];

const EXPENSE_FIELDS = [
    { key: 'utilitiesAndBills', label: 'Utilities & Bills' },
    { key: 'taxes', label: 'Taxes' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'school', label: 'School' },
    { key: 'family', label: 'Family' },
    { key: 'misc', label: 'Misc' },
];

type IncomeState = Record<string, string>;
type FixedState = Record<string, { amount: string; recurring: boolean }>;

function emptyIncome(): IncomeState {
    return Object.fromEntries(INCOME_FIELDS.map(f => [f.key, '']));
}

function emptyFixed(): FixedState {
    return Object.fromEntries(EXPENSE_FIELDS.map(f => [f.key, { amount: '', recurring: false }]));
}

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MonthlyBudgetPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [income, setIncome] = useState<IncomeState>(emptyIncome());
    const [fixed, setFixed] = useState<FixedState>(emptyFixed());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerYear, setPickerYear] = useState(year);
    const pickerRef = useRef<HTMLDivElement>(null);

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
        fetch(`/api/budget/${year}/${month}`)
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                const inc = emptyIncome();
                const fx = emptyFixed();
                if (data) {
                    if (data.income) {
                        INCOME_FIELDS.forEach(f => {
                            if (data.income[f.key] != null) inc[f.key] = String(data.income[f.key]);
                        });
                    }
                    if (data.fixedExpenses) {
                        EXPENSE_FIELDS.forEach(f => {
                            const e = data.fixedExpenses[f.key];
                            if (e != null) {
                                fx[f.key] = {
                                    amount: e.amount != null ? String(e.amount) : '',
                                    recurring: e.recurring ?? false,
                                };
                            }
                        });
                    }
                }
                setIncome(inc);
                setFixed(fx);
            })
            .finally(() => setLoading(false));
    }, [year, month]);

    function prevMonth() {
        if (month === 1) { setYear(y => y - 1); setMonth(12); }
        else setMonth(m => m - 1);
    }

    function nextMonth() {
        if (month === 12) { setYear(y => y + 1); setMonth(1); }
        else setMonth(m => m + 1);
    }

    const totalIncome = INCOME_FIELDS.reduce((s, f) => s + (parseFloat(income[f.key]) || 0), 0);
    const totalFixed = EXPENSE_FIELDS.reduce((s, f) => s + (parseFloat(fixed[f.key].amount) || 0), 0);
    const totalExpenses = totalFixed;
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
                    income: Object.fromEntries(INCOME_FIELDS.map(f => [f.key, parseFloat(income[f.key]) || 0])),
                    fixedExpenses: Object.fromEntries(
                        EXPENSE_FIELDS.map(f => [
                            f.key,
                            { amount: parseFloat(fixed[f.key].amount) || 0, recurring: fixed[f.key].recurring },
                        ])
                    ),
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

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Budget Planner</h1>
                    <p className={styles.subtitle}>Plan your expected income and fixed expenses.</p>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.monthNavWrap} ref={pickerRef}>
                        <div className={styles.monthNav}>
                            <button className={styles.monthNavBtn} onClick={prevMonth}>&#8249;</button>
                            <button
                                className={styles.monthLabel}
                                onClick={() => setPickerOpen(o => !o)}
                            >
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
                                            onClick={() => {
                                                setYear(pickerYear);
                                                setMonth(i + 1);
                                                setPickerOpen(false);
                                            }}
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
                            INCOME
                        </h2>
                        <div className={styles.rows}>
                            {INCOME_FIELDS.map(f => (
                                <div key={f.key} className={styles.row}>
                                    <label className={styles.rowLabel}>{f.label}</label>
                                    <div className={styles.inputWrap}>
                                        <span className={styles.currency}>$</span>
                                        <input
                                            className={styles.input}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={income[f.key]}
                                            onChange={e => setIncome(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
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
                                {EXPENSE_FIELDS.map(f => (
                                    <div key={f.key} className={styles.row}>
                                        <div className={styles.rowLeft}>
                                            <button
                                                type="button"
                                                className={cx(styles.recurringBtn, fixed[f.key].recurring && styles.recurringOn)}
                                                onClick={() => setFixed(prev => ({
                                                    ...prev,
                                                    [f.key]: { ...prev[f.key], recurring: !prev[f.key].recurring },
                                                }))}
                                                title={fixed[f.key].recurring ? 'Recurring — click to disable' : 'Set as recurring'}
                                            >
                                                <Recurring />
                                            </button>
                                            <label className={styles.rowLabel}>{f.label}</label>
                                        </div>
                                        <div className={styles.inputWrap}>
                                            <span className={styles.currency}>$</span>
                                            <input
                                                className={styles.input}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={fixed[f.key].amount}
                                                onChange={e => setFixed(prev => ({
                                                    ...prev,
                                                    [f.key]: { ...prev[f.key], amount: e.target.value },
                                                }))}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className={styles.card}>
                            <div className={styles.variableHeader}>
                                <h2 className={styles.sectionTitleVariable}>
                                    <DailyLog className={styles.sectionIcon} />
                                    Variable Expenses
                                </h2>
                                <span className={styles.badge}>Auto-pulled from Daily Log</span>
                            </div>
                            <p className={styles.variableEmpty}>
                                Variable expenses will appear here once the Daily Log is set up.
                            </p>
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
