'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import cx from 'classnames';
import type { MonthData } from '@/services/summaries';
import { MONTHS_SHORT, fmt } from '@/lib/format';
import styles from './AnnualOverview.module.css';

const MONTH_ABBRS = MONTHS_SHORT;
const VAR_ORDER = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Education', 'Utilities', 'Others'];

/** "+1,234.00" / "−56.00" */
function fmtNet(v: number): string {
    return `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`;
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

type Line = {
    label: string;
    tag?: 'FIX' | 'DAY';
    values: (number | null)[];
    total: number | null;
    strong?: boolean;
    signed?: boolean;
    pct?: boolean;
    color?: (v: number) => string;
    totalColor?: string;
};

export default function AnnualOverviewPage() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const [year, setYear] = useState(currentYear);
    const [data, setData] = useState<{ year: number; months: MonthData[] | null } | null>(null);
    const [hover, setHover] = useState<number | null>(null);
    const [closed, setClosed] = useState<Record<string, boolean>>({});
    const [view, setView] = useState<'list' | 'table'>('list');
    const [openMonth, setOpenMonth] = useState<number | null>(now.getMonth());

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/annual-overview/${year}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (!cancelled) setData({ year, months: d?.months ?? null }); });
        return () => { cancelled = true; };
    }, [year]);

    const loading = data?.year !== year;
    const months = loading ? null : data.months;

    function changeYear(y: number) {
        setYear(y);
        setHover(null);
        setOpenMonth(y === currentYear ? new Date().getMonth() : null);
    }

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

        // A month counts as having data if it has a saved plan or any daily entries
        const active = months.map(m => m.income.length + m.fixedExpenses.length + m.variable.length > 0);
        const thisMonth = new Date().getMonth();
        const future = months.map((_, i) => year > currentYear || (year === currentYear && i > thisMonth));
        const topDaily = months.map(m => [...m.variable].sort((a, b) => b.total - a.total).slice(0, 2));

        return {
            incomeLabels, fixedLabels, varCats,
            incomeMatrix, fixedMatrix, varMatrix,
            totalIncomeByMonth, totalFixedByMonth, totalVariableByMonth, totalExpensesByMonth,
            netSavingsByMonth, savingsPctByMonth,
            totalIncomeTotal, totalExpensesTotal, netSavingsTotal, avgSavingsPct, validPctMonths,
            active, future, topDaily,
        };
    }, [months, year, currentYear]);

    const hasData = !!computed && computed.active.some(Boolean);

    function handleExport() {
        if (!computed || !hasData) return;
        exportCSV(
            year,
            computed.incomeLabels, computed.fixedLabels, computed.varCats,
            computed.incomeMatrix, computed.fixedMatrix, computed.varMatrix,
            computed.totalIncomeByMonth, computed.totalExpensesByMonth,
            computed.netSavingsByMonth, computed.savingsPctByMonth,
        );
    }

    const toolbar = (
        <div className={styles.toolbar}>
            <button className={styles.navBtn} onClick={() => changeYear(year - 1)} aria-label="Previous year">‹</button>
            <span className={styles.yearLabel}>{year}</span>
            <button className={styles.navBtn} onClick={() => changeYear(year + 1)} aria-label="Next year">›</button>
            {hasData && computed && (
                <span className={styles.coverage}>
                    {computed.active.filter(Boolean).length} OF 12 MONTHS WITH DATA
                    {computed.future.some(Boolean) && ` · ${computed.future.filter(Boolean).length} UPCOMING`}
                </span>
            )}
            <button className={styles.exportBtn} onClick={handleExport} disabled={!hasData}>↓ EXPORT CSV</button>
        </div>
    );

    if (loading || !computed || !hasData) {
        return (
            <div className={styles.page}>
                {toolbar}
                {loading ? (
                    <div className={styles.loadingLine}>LOADING {year}<span className={styles.cursor}>_</span></div>
                ) : (
                    <div className={styles.empty}>
                        <span className="label">{year}</span>
                        <span className={styles.emptyTitle}>No data found for {year}.</span>
                        <span className={styles.emptyText}>
                            Save a monthly budget or log a daily expense in {year} and it&apos;ll show up here.
                        </span>
                    </div>
                )}
            </div>
        );
    }

    const c = computed;
    const rateOf = (i: number) => {
        const p = c.savingsPctByMonth[i];
        return p === null ? null : Math.max(0, Math.min(100, Math.round(p)));
    };
    const avgRate = c.avgSavingsPct === null ? null : Math.max(0, Math.round(c.avgSavingsPct));
    const idle = (i: number) => c.future[i] && !c.active[i];

    // Bar chart: zero line splits the height between the biggest gain and the biggest loss
    const maxPos = Math.max(1, ...c.netSavingsByMonth.map(v => Math.max(0, v)));
    const maxNeg = Math.max(0, ...c.netSavingsByMonth.map(v => Math.max(0, -v)));
    const posShare = maxNeg ? maxPos / (maxPos + maxNeg) : 1;

    const lines = (key: string): Line[] => {
        if (key === 'inc') {
            return c.incomeLabels.map((label, ri) => ({ label, values: c.incomeMatrix[ri], total: c.incomeMatrix[ri].reduce((s, v) => s + v, 0) }));
        }
        return [
            ...c.fixedLabels.map((label, ri) => ({ label, tag: 'FIX' as const, values: c.fixedMatrix[ri], total: c.fixedMatrix[ri].reduce((s, v) => s + v, 0) })),
            ...c.varCats.map((label, ri) => ({ label, tag: 'DAY' as const, values: c.varMatrix[ri], total: c.varMatrix[ri].reduce((s, v) => s + v, 0) })),
        ];
    };

    const groups: { key: string; title: string; collapsible: boolean; body: Line[]; foot: Line[] }[] = [
        {
            key: 'inc', title: 'INCOME', collapsible: true, body: lines('inc'),
            foot: [{ label: 'Total income', values: c.totalIncomeByMonth, total: c.totalIncomeTotal, strong: true, color: () => 'var(--income)', totalColor: 'var(--income)' }],
        },
        {
            key: 'exp', title: 'EXPENSES', collapsible: true, body: lines('exp'),
            foot: [{ label: 'Total expenses', values: c.totalExpensesByMonth, total: c.totalExpensesTotal, strong: true, color: () => 'var(--expense)', totalColor: 'var(--expense)' }],
        },
        {
            key: 'sav', title: 'SAVINGS', collapsible: false, body: [],
            foot: [
                {
                    label: 'Net savings', values: c.netSavingsByMonth, total: c.netSavingsTotal, strong: true, signed: true,
                    color: v => v < 0 ? 'var(--neg)' : 'var(--pos)', totalColor: c.netSavingsTotal < 0 ? 'var(--neg)' : 'var(--pos)',
                },
                { label: 'Savings %', values: MONTH_ABBRS.map((_, i) => rateOf(i)), total: avgRate, pct: true },
            ],
        },
    ];

    function cellText(line: Line, v: number | null): string {
        if (v === null) return '—';
        if (line.pct) return `${v}%`;
        if (v === 0) return '0';
        return line.signed ? fmtNet(v) : fmt(v);
    }

    function renderLine(line: Line) {
        return (
            <div key={line.label + (line.tag ?? '')} className={cx(styles.tr, line.strong && styles.trStrong)}>
                <span className={styles.tdLabel}>
                    {line.tag && <span className={cx(styles.tag, line.tag === 'DAY' && styles.tagDay)}>{line.tag}</span>}
                    {line.label}
                </span>
                {line.values.map((v, i) => idle(i) ? (
                    <span key={i} className={cx(styles.td, styles.tdIdle)}>·</span>
                ) : (
                    <span
                        key={i}
                        className={cx(styles.td, 'num', hover === i && styles.tdHover, (v === 0 || v === null) && styles.tdZero)}
                        style={v ? { color: line.color?.(v) } : undefined}
                    >
                        {cellText(line, v)}
                    </span>
                ))}
                <span className={cx(styles.tdTotal, 'num')} style={{ color: line.totalColor }}>
                    {line.total === null ? '—' : line.pct ? `${line.total}%` : line.signed ? fmtNet(line.total) : fmt(line.total)}
                </span>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {toolbar}

            <div className={styles.kpis}>
                <div className={cx(styles.kpi, styles.kpiNet)}>
                    <span className="label">Net savings · {year}</span>
                    <span className={cx(styles.netValue, 'num')} style={{ color: c.netSavingsTotal < 0 ? 'var(--neg)' : 'var(--pos)' }}>
                        {fmtNet(c.netSavingsTotal)}
                    </span>
                </div>
                <div className={styles.kpi}>
                    <span className="label">Income</span>
                    <span className={cx(styles.kpiValue, 'num')} style={{ color: 'var(--income)' }}>{fmt(c.totalIncomeTotal)}</span>
                </div>
                <div className={styles.kpi}>
                    <span className="label">Spent</span>
                    <span className={cx(styles.kpiValue, 'num')} style={{ color: 'var(--expense)' }}>{fmt(c.totalExpensesTotal)}</span>
                </div>
                <div className={cx(styles.kpi, styles.kpiRate)}>
                    <span className="label">Avg savings rate</span>
                    <span className={cx(styles.kpiValue, 'num')}>{avgRate === null ? '—' : `${avgRate}%`}</span>
                    <span className={styles.note}>{c.validPctMonths.length} MONTHS WITH INCOME</span>
                </div>
            </div>

            <div className={styles.chartBlock}>
                <div className={styles.chartHead}>
                    <span>NET SAVINGS BY MONTH</span>
                    <span className={styles.chartLegend}>
                        <span><span className={styles.swatch} style={{ background: 'var(--pos)' }} />SAVED</span>
                        <span><span className={styles.swatch} style={{ background: 'var(--neg)' }} />OVERSPENT</span>
                    </span>
                </div>
                <div className={styles.chart} onMouseLeave={() => setHover(null)}>
                    {c.netSavingsByMonth.map((net, i) => {
                        const isIdle = idle(i);
                        const faded = hover !== null && hover !== i;
                        return (
                            <div
                                key={i}
                                className={cx(styles.barCol, hover === i && styles.barColHover)}
                                onMouseEnter={() => setHover(i)}
                                onClick={() => setHover(i)}
                            >
                                <div className={styles.posPart} style={{ flex: posShare }}>
                                    <div className={styles.posBar} style={{ height: net > 0 ? `${(net / maxPos) * 100}%` : 0, opacity: faded ? 0.45 : 1 }} />
                                </div>
                                <div className={styles.negPart} style={{ flex: 1 - posShare }}>
                                    <div className={styles.negBar} style={{ height: net < 0 && maxNeg ? `${(-net / maxNeg) * 100}%` : 0, opacity: faded ? 0.45 : 1 }} />
                                </div>
                                {isIdle && <div className={styles.upcoming}>UPCOMING</div>}
                                {hover === i && !isIdle && (
                                    <div className={cx(styles.tip, i > 8 && styles.tipRight)}>
                                        <span className={styles.tipTitle}>{MONTH_ABBRS[i].toUpperCase()} {year}</span>
                                        <span className={styles.tipRow}><span>INCOME</span><span>{fmt(c.totalIncomeByMonth[i])}</span></span>
                                        <span className={styles.tipRow}><span>EXPENSES</span><span>{fmt(c.totalExpensesByMonth[i])}</span></span>
                                        <span className={cx(styles.tipRow, styles.tipNet)} style={{ color: net < 0 ? 'var(--tip-neg)' : 'var(--tip-pos)' }}>
                                            <span>NET</span><span>{fmtNet(net)}</span>
                                        </span>
                                        <span className={styles.tipRow}><span>RATE</span><span>{rateOf(i) === null ? '—' : `${rateOf(i)}%`}</span></span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className={styles.chartLabels}>
                    {MONTH_ABBRS.map((m, i) => (
                        <span
                            key={m}
                            style={{ color: c.future[i] ? 'var(--faint)' : c.netSavingsByMonth[i] < 0 ? 'var(--neg)' : undefined }}
                        >
                            {m.toUpperCase()}
                        </span>
                    ))}
                </div>
            </div>

            {/* Phone: month list or full table */}
            <div className={styles.viewTabs}>
                <button className={cx(styles.viewTab, view === 'list' && styles.viewTabActive)} onClick={() => setView('list')}>BY MONTH</button>
                <button className={cx(styles.viewTab, view === 'table' && styles.viewTabActive)} onClick={() => setView('table')}>FULL TABLE</button>
            </div>

            <div className={cx(styles.monthList, view !== 'list' && styles.phoneHidden)}>
                {MONTH_ABBRS.map((m, i) => {
                    const isIdle = idle(i);
                    const open = openMonth === i && !isIdle;
                    const net = c.netSavingsByMonth[i];
                    const rate = rateOf(i);
                    const top = c.topDaily[i].map(t => `${t.category} ${fmt(t.total)}`).join(' · ');
                    return (
                        <div key={m} className={cx(styles.monthCard, open && styles.monthCardOpen)}>
                            <button
                                className={styles.monthHead}
                                onClick={() => !isIdle && setOpenMonth(open ? null : i)}
                                disabled={isIdle}
                            >
                                <span className={styles.monthName} style={{ color: isIdle ? 'var(--faint)' : undefined }}>{m.toUpperCase()}</span>
                                <span className={cx(styles.monthNet, 'num')} style={{ color: isIdle ? 'var(--faint)' : net < 0 ? 'var(--neg)' : 'var(--pos)' }}>
                                    {isIdle ? 'UPCOMING' : fmtNet(net)}
                                </span>
                                <span className={styles.monthRate}>{isIdle ? '' : rate === null ? '—' : `${rate}%`}</span>
                                {!isIdle && <span className={cx(styles.chev, open && styles.chevUp)} aria-hidden="true" />}
                            </button>
                            {open && (
                                <div className={styles.monthBody}>
                                    <span className={styles.monthLine}><span>INCOME</span><span style={{ color: 'var(--income)' }}>{fmt(c.totalIncomeByMonth[i])}</span></span>
                                    <span className={styles.monthLine}><span>FIXED</span><span>{fmt(c.totalFixedByMonth[i])}</span></span>
                                    <span className={styles.monthLine}><span>DAILY</span><span>{fmt(c.totalVariableByMonth[i])}</span></span>
                                    <span className={cx(styles.monthLine, styles.monthTotal)}>
                                        <span>TOTAL EXPENSES</span><span style={{ color: 'var(--expense)' }}>{fmt(c.totalExpensesByMonth[i])}</span>
                                    </span>
                                    <span className={styles.monthTop}>{top ? `TOP DAILY · ${top.toUpperCase()}` : 'NO DAILY ENTRIES'}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className={cx(styles.tableWrap, view !== 'table' && styles.phoneHidden)}>
                <div className={styles.tableScroll}>
                    <div className={styles.table}>
                        <div className={cx(styles.tr, styles.thead)}>
                            <span className={styles.tdLabel}>CATEGORY</span>
                            {MONTH_ABBRS.map((m, i) => (
                                <span
                                    key={m}
                                    className={cx(styles.td, hover === i && styles.tdHover)}
                                    style={{ color: c.future[i] ? 'var(--faint)' : hover === i ? 'var(--text)' : undefined }}
                                >
                                    {m.toUpperCase()}
                                </span>
                            ))}
                            <span className={styles.tdTotal}>TOTAL</span>
                        </div>
                        {groups.map(g => (
                            <Fragment key={g.key}>
                                <button
                                    className={cx(styles.tr, styles.groupRow)}
                                    onClick={() => g.collapsible && setClosed(s => ({ ...s, [g.key]: !s[g.key] }))}
                                    disabled={!g.collapsible}
                                    aria-expanded={!closed[g.key]}
                                >
                                    <span className={styles.tdLabel}>
                                        <span className={cx(styles.groupCaret, closed[g.key] && styles.groupCaretClosed)} aria-hidden="true" />
                                        {g.title}
                                    </span>
                                </button>
                                {!closed[g.key] && g.body.map(renderLine)}
                                {g.foot.map(renderLine)}
                            </Fragment>
                        ))}
                    </div>
                </div>
                <div className={styles.footnote}>
                    FIX = FROM MONTHLY BUDGET · DAY = FROM DAILY LOG · YEARLY SAVINGS % = AVERAGE OF MONTHS WITH INCOME · CLICK A SECTION TO COLLAPSE
                </div>
            </div>
        </div>
    );
}
