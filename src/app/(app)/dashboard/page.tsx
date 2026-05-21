'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import cx from 'classnames';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import styles from './Dashboard.module.css';
import type { DashboardData } from '@/services/budget';
import FoodDining from '@/common/icons/FoodDining';
import TransportCar from '@/common/icons/TransportCar';
import ShoppingBag from '@/common/icons/ShoppingBag';
import HealthHeart from '@/common/icons/HealthHeart';
import EntertainmentIcon from '@/common/icons/EntertainmentIcon';
import EducationBook from '@/common/icons/EducationBook';
import UtilitiesBolt from '@/common/icons/UtilitiesBolt';
import OthersGrid from '@/common/icons/OthersGrid';
import Bank from '@/common/icons/Bank';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const CATEGORY_COLORS: Record<string, string> = {
    Food: '#F59E0B',
    Transport: '#3B82F6',
    Shopping: '#EC4899',
    Health: '#10B981',
    Entertainment: '#8B5CF6',
    Education: '#06B6D4',
    Utilities: '#F97316',
    Others: '#6B7280',
    Housing: '#7B61FF',
    Tax: '#EF4444',
    Insurance: '#14B8A6',
    Family: '#A78BFA',
    Other: '#9CA3AF',
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
    Housing: Bank,
    Tax: OthersGrid,
    Insurance: OthersGrid,
    Family: OthersGrid,
    Other: OthersGrid,
};

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateInt(d: number): string {
    const y = Math.floor(d / 10000);
    const m = Math.floor((d % 10000) / 100);
    const day = d % 100;
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ChartTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const { name, value } = payload[0];
    return (
        <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.75rem',
        }}>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{name}</div>
            <div style={{ color: 'var(--text-muted)' }}>${fmt(value)}</div>
        </div>
    );
}

export default function DashboardPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    function prevMonth() {
        if (month === 1) { setYear(y => y - 1); setMonth(12); }
        else setMonth(m => m - 1);
    }
    function nextMonth() {
        if (month === 12) { setYear(y => y + 1); setMonth(1); }
        else setMonth(m => m + 1);
    }

    useEffect(() => {
        setLoading(true);
        fetch(`/api/dashboard/${year}/${month}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => setData(d))
            .finally(() => setLoading(false));
    }, [year, month]);

    const totalIncome   = data?.totalIncome ?? 0;
    const totalFixed    = data?.totalFixed ?? 0;
    const totalVariable = data?.totalVariable ?? 0;
    const totalExpenses = totalFixed + totalVariable;
    const netSavings    = totalIncome - totalExpenses;
    const savingsRate   = totalIncome > 0
        ? Math.max(0, Math.min(100, Math.round((netSavings / totalIncome) * 100)))
        : 0;

    const chartData = (data?.expensesByCategory ?? []).map(c => ({
        name: c.category,
        value: c.total,
        color: CATEGORY_COLORS[c.category] ?? '#6B7280',
    }));

    const topCategory = chartData[0];
    const totalForPct = chartData.reduce((s, c) => s + c.value, 0);

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className="pageTitle">Dashboard</h1>
                    <p className="pageSubtitle">Your financial overview for {MONTHS[month - 1]} {year}.</p>
                </div>
                <div className={styles.monthNav}>
                    <button className={styles.monthNavBtn} onClick={prevMonth}>&#8249;</button>
                    <span className={styles.monthLabel}>{MONTHS[month - 1]} {year}</span>
                    <button className={styles.monthNavBtn} onClick={nextMonth}>&#8250;</button>
                </div>
            </div>

            {loading ? (
                <p className={styles.loading}>Loading...</p>
            ) : (
                <>
                    {/* Summary cards */}
                    <div className={styles.summaryCards}>
                        <div className={styles.summaryCard}>
                            <span className={styles.summaryCardLabel}>Total Income</span>
                            <span className={cx(styles.summaryCardValue, styles.valueIncome)}>${fmt(totalIncome)}</span>
                        </div>
                        <div className={styles.summaryCard}>
                            <span className={styles.summaryCardLabel}>Total Expenses</span>
                            <span className={cx(styles.summaryCardValue, styles.valueExpense)}>${fmt(totalExpenses)}</span>
                        </div>
                        <div className={styles.summaryCard}>
                            <span className={styles.summaryCardLabel}>Net Savings</span>
                            <span className={cx(styles.summaryCardValue, netSavings >= 0 ? styles.valuePositive : styles.valueNegative)}>
                                {netSavings < 0 ? '-' : ''}${fmt(Math.abs(netSavings))}
                            </span>
                        </div>
                        <div className={styles.summaryCard}>
                            <span className={styles.summaryCardLabel}>Savings Rate</span>
                            <span className={cx(styles.summaryCardValue, styles.valueIncome)}>
                                {totalIncome > 0 ? `${savingsRate}%` : '—'}
                            </span>
                            <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{ width: `${savingsRate}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* Main content */}
                    <div className={styles.mainGrid}>
                        {/* Expense breakdown */}
                        <section className={styles.card}>
                            <h2 className={styles.cardTitle}>Expense Breakdown</h2>
                            {chartData.length === 0 ? (
                                <div className={styles.chartEmpty}>No expenses this month</div>
                            ) : (
                                <>
                                    <div className={styles.donutWrap}>
                                        <ResponsiveContainer width="100%" height={220}>
                                            <PieChart>
                                                <Pie
                                                    data={chartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={62}
                                                    outerRadius={90}
                                                    dataKey="value"
                                                    startAngle={90}
                                                    endAngle={-270}
                                                    paddingAngle={2}
                                                >
                                                    {chartData.map(entry => (
                                                        <Cell key={entry.name} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<ChartTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        {topCategory && (
                                            <div className={styles.donutCenter}>
                                                <span className={styles.donutCenterLabel}>Top Expense</span>
                                                <span className={styles.donutCenterValue}>{topCategory.name}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.legend}>
                                        {chartData.map(c => (
                                            <div key={c.name} className={styles.legendItem}>
                                                <span className={styles.legendDot} style={{ background: c.color }} />
                                                <span className={styles.legendName}>{c.name}</span>
                                                <span className={styles.legendPct}>
                                                    {totalForPct > 0 ? Math.round((c.value / totalForPct) * 100) : 0}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </section>

                        {/* Recent transactions */}
                        <section className={styles.card}>
                            <div className={styles.recentHeader}>
                                <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>Recent Transactions</h2>
                                <Link href="/daily-log" className={styles.viewAllLink}>View All</Link>
                            </div>
                            {(data?.recentTransactions ?? []).length === 0 ? (
                                <p className={styles.txEmpty}>No transactions this month yet.</p>
                            ) : (
                                <div className={styles.txList}>
                                    {(data?.recentTransactions ?? []).map(tx => {
                                        const Icon = CATEGORY_ICONS[tx.category] ?? OthersGrid;
                                        const color = CATEGORY_COLORS[tx.category] ?? '#6B7280';
                                        return (
                                            <div key={tx._id} className={styles.txRow}>
                                                <div className={styles.txIconWrap} style={{ background: `${color}22` }}>
                                                    <Icon width="18" height="18" style={{ color }} />
                                                </div>
                                                <div className={styles.txInfo}>
                                                    <div className={styles.txName}>{tx.note || tx.category}</div>
                                                    <div className={styles.txMeta}>{formatDateInt(tx.date)} &bull; {tx.category}</div>
                                                </div>
                                                <span className={styles.txAmt}>-${fmt(tx.amount)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>
                </>
            )}
        </div>
    );
}
