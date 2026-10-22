'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import cx from 'classnames';
import type { DashboardData } from '@/services/budget';
import { dailyCategory, fixedCategory } from '@/common/constants/categories';
import { useExpense } from '@/context/ExpenseContext';
import MonthPicker from '@/common/components/MonthPicker';
import CategoryTag from '@/common/components/CategoryTag';
import SegmentBar from '@/common/components/SegmentBar';
import { DOW, fmt, fmtSigned, fmtMonth, fmtDayShort, todayInt } from '@/lib/format';
import styles from './Dashboard.module.css';

const HEAT = ['var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'];

function heatLevel(ratio: number): number {
    return ratio < 0.25 ? 0 : ratio < 0.5 ? 1 : ratio < 0.8 ? 2 : 3;
}

function compact(v: number): string {
    return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0);
}

export default function DashboardPage() {
    const now = new Date();
    const { openAdd, version } = useExpense();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [data, setData] = useState<DashboardData | null>(null);
    const [loadedKey, setLoadedKey] = useState('');

    // Refetches on month change (with skeleton) and after an add from the shell (silently)
    useEffect(() => {
        const key = `${year}-${month}`;
        let cancelled = false;
        fetch(`/api/dashboard/${year}/${month}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (cancelled) return;
                setData(d);
                setLoadedKey(key);
            });
        return () => { cancelled = true; };
    }, [year, month, version]);

    const loading = loadedKey !== `${year}-${month}`;

    const label = fmtMonth(year, month);
    const today = todayInt();
    const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1;

    const totalIncome = data?.totalIncome ?? 0;
    const totalFixed = data?.totalFixed ?? 0;
    const totalVariable = data?.totalVariable ?? 0;
    const totalExpenses = totalFixed + totalVariable;
    const net = totalIncome - totalExpenses;
    const rate = totalIncome > 0 ? Math.max(0, Math.min(100, Math.round((net / totalIncome) * 100))) : null;
    const budgetSaved = data?.budgetSaved ?? false;
    const hasEntries = (data?.dailyTotals.length ?? 0) > 0;

    // Calendar heatmap: Monday-first weeks, future days dimmed
    const byDay = Object.fromEntries((data?.dailyTotals ?? []).map(d => [d.date, d.total]));
    const maxDay = Math.max(1, ...Object.values(byDay));
    const daysInMonth = new Date(year, month, 0).getDate();
    const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => {
        const day = i - lead + 1;
        if (day < 1 || day > daysInMonth) return null;
        const dateInt = year * 10000 + month * 100 + day;
        const total = byDay[dateInt] ?? 0;
        return { day, dateInt, total, upcoming: dateInt > today, isToday: dateInt === today };
    });

    const dailyBars = data?.variableByCategory ?? [];
    const fixedBars = (data?.fixedByCategory ?? []).filter(c => c.total > 0);
    const dailyMax = dailyBars[0]?.total ?? 1;

    function setMonthYear(y: number, m: number) {
        setYear(y);
        setMonth(m);
    }

    function addFirst() {
        openAdd(isThisMonth ? today : year * 10000 + month * 100 + 1);
    }

    return (
        <div className={styles.page}>
            <div className={styles.toolbar}>
                <MonthPicker year={year} month={month} onChange={setMonthYear} className={styles.picker} />
                <div className={styles.toolbarRight}>
                    <span className={styles.status}>
                        <span className={styles.dot} style={{ background: budgetSaved ? 'var(--pos)' : 'var(--primary)' }} />
                        {budgetSaved ? 'BUDGET SAVED' : 'NO SAVED BUDGET · INCOME COUNTS AS $0'}
                    </span>
                    <button className={styles.ghostBtn} onClick={() => setMonthYear(now.getFullYear(), now.getMonth() + 1)}>
                        THIS MONTH
                    </button>
                </div>
            </div>

            {loading ? (
                <>
                    <div className={styles.kpis}>
                        {['160px', '110px', '110px', '80px'].map((w, i) => (
                            <div key={i} className={cx(styles.kpi, i === 0 && styles.kpiNet, i === 3 && styles.kpiRate)}>
                                <span className={styles.skel} style={{ width: 90, height: 10 }} />
                                <span className={styles.skel} style={{ width: w, height: 28 }} />
                            </div>
                        ))}
                    </div>
                    <div className={styles.loadingLine}>LOADING {label}<span className={styles.cursor}>_</span></div>
                    <div className={styles.mid}>
                        <div className={styles.panel}><div className={styles.skelBlock} /></div>
                        <div className={styles.panel}>
                            <span className={styles.skel} style={{ height: 12 }} />
                            <span className={styles.skel} style={{ height: 12, width: '70%' }} />
                            <span className={styles.skel} style={{ height: 12, width: '45%' }} />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className={styles.kpis}>
                        <div className={cx(styles.kpi, styles.kpiNet)}>
                            <span className="label">Net savings</span>
                            <span
                                className={cx(styles.netValue, 'num')}
                                style={{ color: net < 0 ? 'var(--neg)' : net > 0 ? 'var(--pos)' : 'var(--muted)' }}
                            >
                                {fmtSigned(net)}
                            </span>
                            <span className={styles.note}>INCOME − EXPENSES</span>
                        </div>
                        <div className={styles.kpi}>
                            <span className="label">Income</span>
                            <span className={cx(styles.kpiValue, 'num')} style={{ color: 'var(--income)' }}>{fmt(totalIncome)}</span>
                            <span className={styles.note}>{budgetSaved ? 'SAVED BUDGET' : 'NO BUDGET SAVED'}</span>
                        </div>
                        <div className={styles.kpi}>
                            <span className="label">Expenses</span>
                            <span className={cx(styles.kpiValue, 'num')} style={{ color: 'var(--expense)' }}>{fmt(totalExpenses)}</span>
                            <span className={styles.note}>FIX {fmt(totalFixed)} / DAY {fmt(totalVariable)}</span>
                        </div>
                        <div className={cx(styles.kpi, styles.kpiRate)}>
                            <span className="label">Savings rate</span>
                            <span className={cx(styles.kpiValue, 'num')}>{rate === null ? '—' : `${rate}%`}</span>
                            <SegmentBar rate={rate} negative={net < 0 && totalIncome > 0} />
                        </div>
                    </div>

                    {(!budgetSaved || !hasEntries) && (
                        <div className={styles.guide}>
                            <span className={styles.guideTitle}>GET {label} STARTED</span>
                            <div className={styles.guideSteps}>
                                <Link href="/monthly-budget" className={styles.guideStep}>
                                    <span className={styles.guideMark} style={{ color: budgetSaved ? 'var(--pos)' : 'var(--primary)' }}>
                                        {budgetSaved ? '✓' : '01'}
                                    </span>
                                    <span className={styles.guideBody}>
                                        <span className={styles.guideHead}>Save a budget for {label}</span>
                                        <span className={styles.guideText}>
                                            Income only counts once the month&apos;s budget is saved. We&apos;ll start you from last month&apos;s rows.
                                        </span>
                                        <span className={styles.guideCta}>OPEN BUDGET →</span>
                                    </span>
                                </Link>
                                <button className={styles.guideStep} onClick={addFirst}>
                                    <span className={styles.guideMark} style={{ color: hasEntries ? 'var(--pos)' : 'var(--primary)' }}>
                                        {hasEntries ? '✓' : '02'}
                                    </span>
                                    <span className={styles.guideBody}>
                                        <span className={styles.guideHead}>Log your first expense</span>
                                        <span className={styles.guideText}>
                                            Press N anywhere, or tap + on your phone. It defaults to today and Food.
                                        </span>
                                        <span className={styles.guideCta}>+ ADD EXPENSE →</span>
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={styles.mid}>
                        {/* Daily spend heatmap */}
                        <div className={styles.panel}>
                            <div className={styles.panelHead}>
                                <span>DAILY SPEND · {label}</span>
                                <span className={styles.legend}>
                                    LESS
                                    {['var(--heat-0)', ...HEAT].map(c => <span key={c} className={styles.legendCell} style={{ background: c }} />)}
                                    MORE
                                </span>
                            </div>
                            <div className={styles.dow}>{DOW.map(d => <span key={d}>{d}</span>)}</div>
                            <div className={styles.heat}>
                                {cells.map((c, i) => {
                                    if (!c) return <div key={i} />;
                                    if (c.upcoming) {
                                        return <div key={i} className={cx(styles.cell, styles.cellUpcoming)} title="Upcoming"><span>{c.day}</span></div>;
                                    }
                                    const level = c.total > 0 ? heatLevel(c.total / maxDay) : -1;
                                    const bg = level < 0 ? 'var(--heat-0)' : HEAT[level];
                                    return (
                                        <div
                                            key={i}
                                            className={cx(styles.cell, level === 3 && styles.cellHot, c.isToday && styles.cellToday)}
                                            style={{ background: bg }}
                                            title={`${fmtDayShort(c.dateInt)} · $${fmt(c.total)}`}
                                        >
                                            <span>{c.day}</span>
                                            <span className={styles.cellValue}>{c.total > 0 ? compact(c.total) : ''}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Daily by category + fixed from budget */}
                        <div className={cx(styles.panel, styles.cats)}>
                            <div className={styles.panelHead}><span>DAILY BY CATEGORY</span><span>{fmt(totalVariable)}</span></div>
                            {dailyBars.map(b => {
                                const c = dailyCategory(b.category);
                                return (
                                    <div key={b.category} className={styles.catRow} title={`${b.category} · $${fmt(b.total)}`}>
                                        <span className={styles.catName}><span className={styles.swatch} style={{ background: c.color }} />{b.category.toUpperCase()}</span>
                                        <div className={styles.track}><div style={{ width: `${(b.total / dailyMax) * 100}%`, background: c.color }} /></div>
                                        <span className={styles.catPct}>{totalVariable > 0 ? Math.round((b.total / totalVariable) * 100) : 0}%</span>
                                        <span className={cx(styles.catAmt, 'num')}>{fmt(b.total)}</span>
                                    </div>
                                );
                            })}
                            {dailyBars.length === 0 && totalExpenses > 0 && <span className={styles.empty}>No daily expenses this month</span>}

                            <div className={cx(styles.panelHead, styles.fixedHead)}><span>FIXED · FROM BUDGET</span><span>{fmt(totalFixed)}</span></div>
                            {fixedBars.length > 0 && (
                                <>
                                    <div className={styles.stack}>
                                        {fixedBars.map(b => (
                                            <span
                                                key={b.category}
                                                title={`${b.category} · $${fmt(b.total)}`}
                                                style={{ width: `${(b.total / totalFixed) * 100}%`, background: fixedCategory(b.category).color }}
                                            />
                                        ))}
                                    </div>
                                    <div className={styles.stackLegend}>
                                        {fixedBars.map(b => (
                                            <span key={b.category} title={`${b.category} · $${fmt(b.total)}`}>
                                                <span className={styles.swatch} style={{ background: fixedCategory(b.category).color }} />
                                                {b.category.toUpperCase()} {Math.round((b.total / totalFixed) * 100)}%
                                            </span>
                                        ))}
                                    </div>
                                </>
                            )}
                            {fixedBars.length === 0 && totalExpenses > 0 && (
                                <span className={styles.empty}>No fixed expenses — this month&apos;s budget isn&apos;t saved.</span>
                            )}
                            {totalExpenses === 0 && <span className={styles.noExpenses}>No expenses this month</span>}
                        </div>
                    </div>

                    {/* Recent transactions */}
                    <div className={styles.recent}>
                        <div className={styles.recentHead}>
                            <span>RECENT · LATEST 10</span>
                            <Link href="/daily-log" className={styles.viewAll}>VIEW ALL →</Link>
                        </div>
                        {(data?.recentTransactions ?? []).length === 0 ? (
                            <div className={styles.recentEmpty}>
                                <span>No transactions this month yet.</span>
                                <button className={styles.outlineBtn} onClick={addFirst}>+ ADD EXPENSE</button>
                            </div>
                        ) : (data?.recentTransactions ?? []).map(tx => (
                            <div key={tx._id} className={styles.txRow}>
                                <span className={styles.txDate}>{fmtDayShort(tx.date)}</span>
                                <span className={styles.txMain}>
                                    <CategoryTag category={dailyCategory(tx.category)} />
                                    <span>{tx.category}</span>
                                    <span className={styles.txNote}>{tx.note}</span>
                                </span>
                                <span className={cx(styles.txAmt, 'num')}>−{fmt(tx.amount)}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
