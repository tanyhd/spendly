'use client';

import { useState, useEffect, useMemo } from 'react';
import cx from 'classnames';
import {
    AreaChart, Area, XAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import styles from './AnnualOverview.module.css';
import type { MonthData } from '@/services/budget';
import YearPicker from '@/common/components/YearPicker';

const MONTH_ABBRS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const VAR_ORDER = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Education', 'Utilities', 'Others'];

function fmt(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n: number): string {
    if (n === 0) return '0';
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const value: number = payload[0].value;
    return (
        <div style={{
            background: '#191829', border: '1px solid #2A2840',
            borderRadius: '0.5rem', padding: '0.5rem 0.875rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
            <div style={{ fontWeight: 600, color: '#FFFFFF', marginBottom: '0.125rem' }}>{label}</div>
            <div style={{ color: value < 0 ? '#EF4444' : '#34D399' }}>
                {value < 0 ? '-' : ''}${fmt(Math.abs(value))}
            </div>
        </div>
    );
}

function CustomDot(props: any) {
    const { cx: x, cy: y, value } = props;
    if (value === 0) return null;
    return <circle cx={x} cy={y} r={3.5} fill={value < 0 ? '#EF4444' : '#8B5CF6'} stroke="#191829" strokeWidth={1.5} />;
}

function exportCSV(
    year: number,
    incomeLabels: string[],
    fixedLabels: string[],
    varCats: string[],
    incomeMatrix: number[][],
    fixedMatrix: number[][],
    varMatrix: number[][],
    totalIncomeByMonth: number[],
    totalExpensesByMonth: number[],
    netSavingsByMonth: number[],
    savingsPctByMonth: (number | null)[],
) {
    const cols = [...MONTH_ABBRS, 'Total'];
    const rows: string[][] = [];

    rows.push([`Annual Overview ${year}`]);
    rows.push(['', ...cols]);

    rows.push(['INCOME']);
    incomeLabels.forEach((label, ri) => {
        const vals = incomeMatrix[ri];
        const total = vals.reduce((s, v) => s + v, 0);
        rows.push([label, ...vals.map(v => v.toFixed(2)), total.toFixed(2)]);
    });
    const totalIncomeTotal = totalIncomeByMonth.reduce((s, v) => s + v, 0);
    rows.push(['Total Income', ...totalIncomeByMonth.map(v => v.toFixed(2)), totalIncomeTotal.toFixed(2)]);

    rows.push(['EXPENSES']);
    fixedLabels.forEach((label, ri) => {
        const vals = fixedMatrix[ri];
        const total = vals.reduce((s, v) => s + v, 0);
        rows.push([label, ...vals.map(v => v.toFixed(2)), total.toFixed(2)]);
    });
    varCats.forEach((cat, ri) => {
        const vals = varMatrix[ri];
        const total = vals.reduce((s, v) => s + v, 0);
        rows.push([`${cat} (daily log)`, ...vals.map(v => v.toFixed(2)), total.toFixed(2)]);
    });
    const totalExpensesTotal = totalExpensesByMonth.reduce((s, v) => s + v, 0);
    rows.push(['Total Expenses', ...totalExpensesByMonth.map(v => v.toFixed(2)), totalExpensesTotal.toFixed(2)]);

    rows.push(['SAVINGS']);
    const netTotal = netSavingsByMonth.reduce((s, v) => s + v, 0);
    rows.push(['Net Savings', ...netSavingsByMonth.map(v => v.toFixed(2)), netTotal.toFixed(2)]);
    const validPctMonths = MONTH_ABBRS.map((_, m) => m).filter(m => totalIncomeByMonth[m] > 0);
    const avgPct = validPctMonths.length > 0
        ? validPctMonths.reduce((s, m) => s + (savingsPctByMonth[m] ?? 0), 0) / validPctMonths.length
        : null;
    rows.push(['Savings %',
        ...savingsPctByMonth.map(v => v != null ? `${Math.round(v)}%` : '—'),
        avgPct != null ? `${Math.round(avgPct)}%` : '—',
    ]);

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spendly-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function AnnualOverviewPage() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const [year, setYear] = useState(currentYear);
    const [months, setMonths] = useState<MonthData[] | null>(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        setLoading(true);
        setMonths(null);
        fetch(`/api/annual-overview/${year}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => setMonths(d?.months ?? null))
            .finally(() => setLoading(false));
    }, [year]);

    const computed = useMemo(() => {
        if (!months) return null;

        const incomeLabels: string[] = [];
        for (const m of months) {
            for (const r of m.income) {
                if (!incomeLabels.includes(r.label)) incomeLabels.push(r.label);
            }
        }

        const fixedLabels: string[] = [];
        for (const m of months) {
            for (const r of m.fixedExpenses) {
                if (!fixedLabels.includes(r.label)) fixedLabels.push(r.label);
            }
        }

        const varCatsSet = new Set<string>();
        for (const m of months) {
            for (const v of m.variable) varCatsSet.add(v.category);
        }
        const varCats = VAR_ORDER.filter(c => varCatsSet.has(c));
        for (const c of varCatsSet) {
            if (!varCats.includes(c)) varCats.push(c);
        }

        const incomeMatrix = incomeLabels.map(label =>
            months.map(m => m.income.find(r => r.label === label)?.amount ?? 0)
        );
        const fixedMatrix = fixedLabels.map(label =>
            months.map(m => m.fixedExpenses.find(r => r.label === label)?.amount ?? 0)
        );
        const varMatrix = varCats.map(cat =>
            months.map(m => m.variable.find(v => v.category === cat)?.total ?? 0)
        );

        const totalIncomeByMonth = months.map((_, mi) =>
            incomeMatrix.reduce((s, row) => s + row[mi], 0)
        );
        const totalFixedByMonth = months.map((_, mi) =>
            fixedMatrix.reduce((s, row) => s + row[mi], 0)
        );
        const totalVariableByMonth = months.map((_, mi) =>
            varMatrix.reduce((s, row) => s + row[mi], 0)
        );
        const totalExpensesByMonth = months.map((_, mi) =>
            totalFixedByMonth[mi] + totalVariableByMonth[mi]
        );
        const netSavingsByMonth = months.map((_, mi) =>
            totalIncomeByMonth[mi] - totalExpensesByMonth[mi]
        );
        const savingsPctByMonth: (number | null)[] = months.map((_, mi) =>
            totalIncomeByMonth[mi] > 0
                ? (netSavingsByMonth[mi] / totalIncomeByMonth[mi]) * 100
                : null
        );

        const totalIncomeTotal = totalIncomeByMonth.reduce((s, v) => s + v, 0);
        const totalExpensesTotal = totalExpensesByMonth.reduce((s, v) => s + v, 0);
        const netSavingsTotal = netSavingsByMonth.reduce((s, v) => s + v, 0);
        const validPctMonths = months.map((_, m) => m).filter(m => totalIncomeByMonth[m] > 0);
        const avgSavingsPct = validPctMonths.length > 0
            ? validPctMonths.reduce((s, m) => s + (savingsPctByMonth[m] ?? 0), 0) / validPctMonths.length
            : null;

        const chartData = MONTH_ABBRS.map((month, i) => ({ month, savings: netSavingsByMonth[i] }));

        return {
            incomeLabels, fixedLabels, varCats,
            incomeMatrix, fixedMatrix, varMatrix,
            totalIncomeByMonth, totalExpensesByMonth, netSavingsByMonth, savingsPctByMonth,
            totalIncomeTotal, totalExpensesTotal, netSavingsTotal, avgSavingsPct,
            chartData,
        };
    }, [months]);

    function handleExport() {
        if (!computed) return;
        exportCSV(
            year,
            computed.incomeLabels, computed.fixedLabels, computed.varCats,
            computed.incomeMatrix, computed.fixedMatrix, computed.varMatrix,
            computed.totalIncomeByMonth, computed.totalExpensesByMonth,
            computed.netSavingsByMonth, computed.savingsPctByMonth,
        );
    }

    function fmtCell(v: number) {
        return fmtNum(v);
    }

    function fmtSavings(v: number) {
        if (v === 0) return <span className={styles.zero}>0</span>;
        return (
            <span className={v < 0 ? styles.negative : styles.positive}>
                {v < 0 ? '-' : ''}{fmtNum(Math.abs(v))}
            </span>
        );
    }

    function fmtPct(v: number | null) {
        if (v === null) return <span className={styles.zero}>—</span>;
        if (v === 0) return <span className={styles.zero}>0%</span>;
        return (
            <span className={v < 0 ? styles.negative : styles.positive}>
                {Math.round(v)}%
            </span>
        );
    }

    const COLS = 14; // name + 12 months + total

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className="pageTitle" style={{ marginBottom: 0 }}>Annual Overview</h1>
                    <YearPicker year={year} onChange={setYear} />
                </div>
                <button className={styles.exportBtn} onClick={handleExport} disabled={!computed}>
                    ↓ Export CSV
                </button>
            </div>

            {loading ? (
                <p className={styles.loading}>Loading...</p>
            ) : !computed ? (
                <p className={styles.loading}>No data found for {year}.</p>
            ) : (
                <>
                    {/* Savings Trend Chart */}
                    <div className={styles.chartCard}>
                        <div className={styles.chartCardHeader}>
                            <span className={styles.chartTitle}>Monthly Savings Trend</span>
                            <div className={styles.chartTotal}>
                                <span className={styles.chartTotalLabel}>Yearly Savings</span>
                                <span className={cx(
                                    styles.chartTotalValue,
                                    computed.netSavingsTotal >= 0 ? styles.chartTotalPositive : styles.chartTotalNegative
                                )}>
                                    {computed.netSavingsTotal < 0 ? '-' : ''}${fmt(Math.abs(computed.netSavingsTotal))}
                                </span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={computed.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2A2840" vertical={false} />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fill: '#8B8FA8', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <ReferenceLine y={0} stroke="#4B4D6B" strokeDasharray="4 4" />
                                <Tooltip content={<ChartTooltip />} wrapperStyle={{ zIndex: 50 }} />
                                <Area
                                    type="monotone"
                                    dataKey="savings"
                                    stroke="#8B5CF6"
                                    strokeWidth={2}
                                    fill="url(#savingsGradient)"
                                    dot={<CustomDot />}
                                    activeDot={{ r: 5, fill: '#8B5CF6' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Annual Table */}
                    <div className={styles.tableCard}>
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Category</th>
                                        {MONTH_ABBRS.map(m => <th key={m}>{m}</th>)}
                                        <th className={styles.totalCol}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Income */}
                                    <tr className={styles.sectionRow}>
                                        <td>Income</td>
                                        <td colSpan={COLS - 1} />
                                    </tr>
                                    {computed.incomeLabels.map((label, ri) => {
                                        const row = computed.incomeMatrix[ri];
                                        const total = row.reduce((s, v) => s + v, 0);
                                        return (
                                            <tr key={label}>
                                                <td>{label}</td>
                                                {row.map((v, mi) => <td key={mi}>{fmtCell(v)}</td>)}
                                                <td className={styles.totalCol}>{fmtCell(total)}</td>
                                            </tr>
                                        );
                                    })}
                                    {computed.incomeLabels.length === 0 && (
                                        <tr>
                                            <td colSpan={COLS} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem' }}>
                                                No income data saved for {year}
                                            </td>
                                        </tr>
                                    )}
                                    <tr className={styles.totalRow}>
                                        <td>Total Income</td>
                                        {computed.totalIncomeByMonth.map((v, mi) => <td key={mi} className={styles.totalValue}>{fmtCell(v)}</td>)}
                                        <td className={cx(styles.totalCol, styles.totalValue)}>{fmtCell(computed.totalIncomeTotal)}</td>
                                    </tr>

                                    {/* Expenses */}
                                    <tr className={styles.sectionRow}>
                                        <td>Expenses</td>
                                        <td colSpan={COLS - 1} />
                                    </tr>
                                    {computed.fixedLabels.map((label, ri) => {
                                        const row = computed.fixedMatrix[ri];
                                        const total = row.reduce((s, v) => s + v, 0);
                                        return (
                                            <tr key={`fixed-${label}`}>
                                                <td>{label}</td>
                                                {row.map((v, mi) => <td key={mi}>{fmtCell(v)}</td>)}
                                                <td className={styles.totalCol}>{fmtCell(total)}</td>
                                            </tr>
                                        );
                                    })}
                                    {computed.varCats.map((cat, ri) => {
                                        const row = computed.varMatrix[ri];
                                        const total = row.reduce((s, v) => s + v, 0);
                                        return (
                                            <tr key={`var-${cat}`}>
                                                <td>{cat}</td>
                                                {row.map((v, mi) => <td key={mi}>{fmtCell(v)}</td>)}
                                                <td className={styles.totalCol}>{fmtCell(total)}</td>
                                            </tr>
                                        );
                                    })}
                                    {computed.fixedLabels.length === 0 && computed.varCats.length === 0 && (
                                        <tr>
                                            <td colSpan={COLS} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem' }}>
                                                No expense data for {year}
                                            </td>
                                        </tr>
                                    )}
                                    <tr className={styles.totalRow}>
                                        <td>Total Expenses</td>
                                        {computed.totalExpensesByMonth.map((v, mi) => <td key={mi} className={styles.totalValue}>{fmtCell(v)}</td>)}
                                        <td className={cx(styles.totalCol, styles.totalValue)}>{fmtCell(computed.totalExpensesTotal)}</td>
                                    </tr>

                                    {/* Savings */}
                                    <tr className={styles.sectionRow}>
                                        <td>Savings</td>
                                        <td colSpan={COLS - 1} />
                                    </tr>
                                    <tr>
                                        <td>Net Savings</td>
                                        {computed.netSavingsByMonth.map((v, mi) => (
                                            <td key={mi}>{fmtSavings(v)}</td>
                                        ))}
                                        <td className={styles.totalCol}>{fmtSavings(computed.netSavingsTotal)}</td>
                                    </tr>
                                    <tr>
                                        <td>Savings %</td>
                                        {computed.savingsPctByMonth.map((v, mi) => (
                                            <td key={mi}>{fmtPct(v)}</td>
                                        ))}
                                        <td className={styles.totalCol}>{fmtPct(computed.avgSavingsPct)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
