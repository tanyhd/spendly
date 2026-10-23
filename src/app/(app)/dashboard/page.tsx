'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import cx from 'classnames';
import type { DashboardData, Summary } from '@/services/summaries';
import type { Entry } from '@/context/ExpenseContext';
import { dailyCategory, fixedCategory } from '@/common/constants/categories';
import { useExpense } from '@/context/ExpenseContext';
import { useToast } from '@/context/ToastContext';
import MonthPicker from '@/common/components/MonthPicker';
import CategoryTag from '@/common/components/CategoryTag';
import SegmentBar from '@/common/components/SegmentBar';
import { DOW, addDaysInt, fmt, fmtSigned, fmtMonth, fmtDayShort, todayInt, plural } from '@/lib/format';
import { PERIODS, periodLabel, periodRange, previousRange, daysIn, type Period } from '@/lib/period';
import type { UpcomingBill, UpcomingResult } from '@/lib/bills';
import { overText } from '@/lib/budgetProgress';
import Insights from './Insights';
import LeftToSpend from './LeftToSpend';
import ByCategory from './ByCategory';
import ComingUp from './ComingUp';
import { WeekBars, IncomeBars } from './PeriodBars';
import styles from './Dashboard.module.css';

const HEAT = ['var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'];

function heatLevel(ratio: number): number {
    return ratio < 0.25 ? 0 : ratio < 0.5 ? 1 : ratio < 0.8 ? 2 : 3;
}

function compact(v: number): string {
    return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0);
}

type Loaded = {
    key: string;
    summary: Summary;
    /** The month view's month, or this month (for the bills footer) while viewing a current period */
    dash: DashboardData | null;
    upcoming: UpcomingResult | null;
    recent: Entry[];
};

export default function DashboardPage() {
    const { openAdd, version } = useExpense();
    const toast = useToast();
    const today = todayInt();
    const [period, setPeriod] = useState<Period>('month');
    const [anchor, setAnchor] = useState(today);
    const [data, setData] = useState<Loaded | null>(null);
    const [refresh, setRefresh] = useState(0);

    const range = periodRange(period, anchor);
    const key = `${period}-${range.start}`;
    const isCurrent = range.start <= today && today <= range.end;
    const timing = today > range.end ? 'past' : today < range.start ? 'future' : 'current';
    const year = Math.floor(anchor / 10000);
    const month = Math.floor(anchor / 100) % 100;
    const thisYear = Math.floor(today / 10000);
    const thisMonth = Math.floor(today / 100) % 100;

    // Refetches on period change (with skeleton), after an add from the shell and after a bill tick (silently)
    useEffect(() => {
        let cancelled = false;
        const dashMonth = period === 'month' ? { y: year, m: month } : isCurrent ? { y: thisYear, m: thisMonth } : null;
        const json = (url: string) => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
        Promise.all([
            json(`/api/summary?period=${period}&anchor=${range.start}`),
            dashMonth ? json(`/api/dashboard/${dashMonth.y}/${dashMonth.m}`) : null,
            isCurrent ? json('/api/bills/upcoming?days=7') : null,
            json(`/api/transactions?from=${range.start}&to=${range.end}&limit=10`),
        ]).then(([summary, dash, upcoming, recent]) => {
            if (cancelled || !summary) return;
            setData({ key, summary, dash, upcoming, recent: recent?.items ?? [] });
        });
        return () => { cancelled = true; };
        // range.start/end, year, month and isCurrent all follow from period + anchor (in key)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, version, refresh]);

    const loading = data?.key !== key;
    const s = loading ? null : data.summary;
    const dash = loading ? null : data.dash;
    const label = period === 'month' ? fmtMonth(year, month) : periodLabel(period, anchor);

    function go(p: Period, a: number) {
        setPeriod(p);
        setAnchor(a);
    }

    function step(delta: -1 | 1) {
        go(period, delta < 0 ? previousRange(period, anchor).start : addDaysInt(range.end, 1));
    }

    async function tick(bill: UpcomingBill) {
        if (!bill.planSaved) {
            toast(`SAVE THE ${fmtMonth(bill.year, bill.month)} BUDGET FIRST, THEN TICK IT`);
            return;
        }
        const paid = !bill.paid;
        setData(d => d && d.upcoming ? {
            ...d,
            upcoming: { ...d.upcoming, items: d.upcoming.items.map(i => i.rowId === bill.rowId && i.month === bill.month ? { ...i, paid } : i) },
        } : d);
        const res = await fetch(`/api/budget/${bill.year}/${bill.month}/bills/${bill.rowId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paid }),
        }).catch(() => null);
        if (!res?.ok) toast('COULD NOT UPDATE THE BILL · TRY AGAIN');
        else if (paid) toast(`PAID ${bill.label.toUpperCase()} $${fmt(bill.amount)}`);
        setRefresh(r => r + 1); // totals, insights and the footer all change
    }

    const p = period.toUpperCase();
    const status = period === 'month' && dash
        ? {
            dot: dash.budgetSaved ? 'var(--pos)' : 'var(--primary)',
            text: dash.budgetSaved ? 'BUDGET SAVED' : 'NO SAVED BUDGET · INCOME COUNTS AS $0',
        }
        : timing === 'current'
            ? { dot: 'var(--primary)', text: `IN PROGRESS · COMPARED WITH SAME POINT LAST ${p}` }
            : timing === 'past'
                ? { dot: 'var(--muted)', text: `COMPARED WITH LAST ${p}` }
                : { dot: 'var(--faint)', text: 'NOT STARTED YET' };

    return (
        <div className={styles.page}>
            <div className={styles.toolbar}>
                {period === 'month' ? (
                    <MonthPicker year={year} month={month} onChange={(y, m) => go('month', y * 10000 + m * 100 + 1)} className={styles.picker} />
                ) : (
                    <div className={styles.periodPicker}>
                        <button className={styles.periodNav} onClick={() => step(-1)} aria-label={`Previous ${period}`}>‹</button>
                        <span className={styles.periodLabel}>{label}</span>
                        <button className={styles.periodNav} onClick={() => step(1)} aria-label={`Next ${period}`}>›</button>
                    </div>
                )}
                <div className={styles.periodTabs} role="group" aria-label="Period">
                    {PERIODS.map(x => (
                        <button
                            key={x}
                            className={cx(styles.periodTab, x === period && styles.periodTabOn)}
                            aria-pressed={x === period}
                            onClick={() => go(x, anchor)}
                        >
                            {x.toUpperCase()}
                        </button>
                    ))}
                </div>
                <div className={styles.toolbarRight}>
                    <span className={styles.status}><span className={styles.dot} style={{ background: status.dot }} />{status.text}</span>
                    <button className={styles.ghostBtn} onClick={() => go(period, today)}>THIS {p}</button>
                </div>
            </div>

            {!s ? (
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
                <Loaded
                    s={s}
                    dash={dash}
                    upcoming={data!.upcoming}
                    recent={data!.recent}
                    period={period}
                    label={label}
                    today={today}
                    year={year}
                    month={month}
                    onTick={tick}
                    onAdd={() => openAdd(isCurrent ? today : range.start)}
                />
            )}
        </div>
    );
}

type LoadedProps = {
    s: Summary;
    dash: DashboardData | null;
    upcoming: UpcomingResult | null;
    recent: Entry[];
    period: Period;
    label: string;
    today: number;
    year: number;
    month: number;
    onTick: (b: UpcomingBill) => void;
    onAdd: () => void;
};

function Loaded({ s, dash, upcoming, recent, period, label, today, year, month, onTick, onAdd }: LoadedProps) {
    const isMonth = period === 'month';
    const current = s.timing === 'current';
    const fixed = s.fixed ?? 0;
    const totalExpenses = fixed + s.daily;
    const net = s.net ?? 0;
    const rate = s.savingsRate === null ? null : Math.max(0, Math.min(100, Math.round(s.savingsRate * 100)));
    const budgetSaved = dash?.budgetSaved ?? false;
    const hasEntries = s.daily > 0 || recent.length > 0;

    return (
        <>
            {period === 'week' ? <WeekKpis s={s} today={today} /> : (
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
                        <span className={cx(styles.kpiValue, 'num')} style={{ color: 'var(--income)' }}>{fmt(s.income ?? 0)}</span>
                        <span className={styles.note}>
                            {isMonth
                                ? (budgetSaved ? 'SAVED BUDGET' : 'NO BUDGET SAVED')
                                : `${s.months?.budgeted ?? 0} OF ${plural(s.months?.total ?? 0, 'MONTH', 'MONTHS')} BUDGETED`}
                        </span>
                    </div>
                    <div className={styles.kpi}>
                        <span className="label">Expenses</span>
                        <span className={cx(styles.kpiValue, 'num')} style={{ color: 'var(--expense)' }}>{fmt(totalExpenses)}</span>
                        <span className={styles.note}>FIX {fmt(fixed)} / DAY {fmt(s.daily)}</span>
                    </div>
                    <div className={cx(styles.kpi, styles.kpiRate)}>
                        <span className="label">Savings rate</span>
                        <span className={cx(styles.kpiValue, 'num')}>{rate === null ? '—' : `${rate}%`}</span>
                        <SegmentBar rate={rate} negative={net < 0 && (s.income ?? 0) > 0} />
                    </div>
                </div>
            )}

            <Insights items={s.insights} />

            {isMonth && (!budgetSaved || !hasEntries) && (
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
                                    Income only counts once the month&apos;s budget is saved. A month with a saved budget before it starts as a copy of it.
                                </span>
                                <span className={styles.guideCta}>OPEN BUDGET →</span>
                            </span>
                        </Link>
                        <button className={styles.guideStep} onClick={onAdd}>
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
                {isMonth ? <Heatmap dash={dash} year={year} month={month} today={today} label={label} />
                    : period === 'week' ? <WeekBars bars={s.bars} today={today} label={label} />
                        : <IncomeBars bars={s.bars} today={today} label={label} />}
                {isMonth
                    ? <LeftToSpend budgets={dash?.budgets ?? null} spent={dash?.variableByCategory ?? []} />
                    : <ByCategory period={period} rows={s.byCategory} timing={s.timing} hasCompare={s.compareRange !== null} />}
            </div>

            {isMonth ? (
                <div className={styles.mid}>
                    {current && upcoming
                        ? <ComingUp upcoming={upcoming} month={dash?.bills ?? null} today={today} onTick={onTick} />
                        : <FixedFromBudget dash={dash} totalExpenses={totalExpenses} />}
                    <div className={styles.stackCol}>
                        <ByCategory period={period} rows={s.byCategory} timing={s.timing} hasCompare={s.compareRange !== null} />
                        {current && upcoming && <FixedFromBudget dash={dash} totalExpenses={totalExpenses} />}
                    </div>
                </div>
            ) : current && upcoming && (
                <ComingUp upcoming={upcoming} month={dash?.bills ?? null} today={today} onTick={onTick} />
            )}

            <div className={styles.recent}>
                <div className={styles.recentHead}>
                    <span>RECENT · {label}</span>
                    {/* Opens All expenses for the same dates as this view */}
                    <Link href={`/daily-log/all?from=${s.range.start}&to=${s.range.end}`} className={styles.viewAll}>VIEW ALL →</Link>
                </div>
                {recent.length === 0 ? (
                    <div className={styles.recentEmpty}>
                        <span>No transactions this {period} yet.</span>
                        <button className={styles.outlineBtn} onClick={onAdd}>+ ADD EXPENSE</button>
                    </div>
                ) : recent.map(tx => (
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
    );
}

/** Week view: spending only, since income is planned per month */
function WeekKpis({ s, today }: { s: Summary; today: number }) {
    const prevTotal = s.byCategory.reduce((t, c) => t + (c.prevSpent ?? 0), 0);
    const diff = s.compareRange ? Math.round((s.daily - prevTotal) * 100) / 100 : null;
    const daysSoFar = s.timing === 'future' ? 0 : s.timing === 'past' ? 7 : daysIn({ start: s.range.start, end: today });
    return (
        <div className={styles.kpis}>
            <div className={cx(styles.kpi, styles.kpiNet)}>
                <span className="label">Spent this week</span>
                <span className={cx(styles.netValue, 'num')} style={{ color: s.daily ? 'var(--primary)' : 'var(--muted)' }}>{fmt(s.daily)}</span>
                <span className={styles.note}>DAILY LOG ONLY · INCOME IS PLANNED MONTHLY</span>
            </div>
            <div className={styles.kpi}>
                <span className="label">{s.timing === 'current' ? 'Vs same point last week' : 'Vs last week'}</span>
                <span className={cx(styles.kpiValue, 'num')} style={{ color: diff === null || diff === 0 ? 'var(--muted)' : diff < 0 ? 'var(--pos)' : 'var(--neg)' }}>
                    {diff === null ? '—' : fmtSigned(diff)}
                </span>
                <span className={styles.note}>{diff === null ? 'NOTHING TO COMPARE YET' : `LAST WEEK ${fmt(prevTotal)}`}</span>
            </div>
            <div className={styles.kpi}>
                <span className="label">Daily average</span>
                <span className={cx(styles.kpiValue, 'num')}>{daysSoFar ? fmt(s.daily / daysSoFar) : '—'}</span>
                <span className={styles.note}>OVER {plural(daysSoFar, 'DAY', 'DAYS')}</span>
            </div>
            <div className={cx(styles.kpi, styles.kpiRate)}>
                <span className="label">This month left to spend</span>
                <span className={cx(styles.kpiValue, 'num')} style={{ color: s.budgets && s.budgets.available === 0 ? 'var(--neg)' : undefined }}>
                    {s.budgets ? fmt(s.budgets.available) : '—'}
                </span>
                <span className={styles.note}>
                    {s.budgets ? overText(s.budgets) ?? `CATEGORY LIMITS · ${fmtMonth(Math.floor(today / 10000), Math.floor(today / 100) % 100)}` : s.timing === 'current' ? 'NO LIMITS SET' : 'SHOWN FOR THIS WEEK'}
                </span>
            </div>
        </div>
    );
}

/** Month view: daily spending as a calendar, Monday-first, days still to come dimmed */
function Heatmap({ dash, year, month, today, label }: { dash: DashboardData | null; year: number; month: number; today: number; label: string }) {
    const byDay = Object.fromEntries((dash?.dailyTotals ?? []).map(d => [d.date, d.total]));
    const maxDay = Math.max(1, ...Object.values(byDay));
    const daysInMonth = new Date(year, month, 0).getDate();
    const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => {
        const day = i - lead + 1;
        if (day < 1 || day > daysInMonth) return null;
        const dateInt = year * 10000 + month * 100 + day;
        return { day, dateInt, total: byDay[dateInt] ?? 0, upcoming: dateInt > today, isToday: dateInt === today };
    });
    return (
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
    );
}

/** The month's fixed expenses by category, as one stacked bar */
function FixedFromBudget({ dash, totalExpenses }: { dash: DashboardData | null; totalExpenses: number }) {
    const totalFixed = dash?.totalFixed ?? 0;
    const bars = (dash?.fixedByCategory ?? []).filter(c => c.total > 0);
    return (
        <div className={cx(styles.panel, styles.fixedPanel)}>
            <div className={styles.panelHead}><span>FIXED · FROM BUDGET</span><span>{fmt(totalFixed)}</span></div>
            {bars.length > 0 ? (
                <>
                    <div className={styles.stack}>
                        {bars.map(b => (
                            <span
                                key={b.category}
                                title={`${b.category} · $${fmt(b.total)}`}
                                style={{ width: `${(b.total / totalFixed) * 100}%`, background: fixedCategory(b.category).color }}
                            />
                        ))}
                    </div>
                    <div className={styles.stackLegend}>
                        {bars.map(b => (
                            <span key={b.category} title={`${b.category} · $${fmt(b.total)}`}>
                                <span className={styles.swatch} style={{ background: fixedCategory(b.category).color }} />
                                {b.category.toUpperCase()} {Math.round((b.total / totalFixed) * 100)}%
                            </span>
                        ))}
                    </div>
                </>
            ) : totalExpenses > 0 ? (
                <span className={styles.empty}>
                    {dash?.budgetSaved
                        ? 'No fixed expenses in this month’s budget.'
                        : 'No fixed expenses — this month’s budget isn’t saved.'}
                </span>
            ) : (
                <span className={styles.empty}>No expenses this month</span>
            )}
        </div>
    );
}
