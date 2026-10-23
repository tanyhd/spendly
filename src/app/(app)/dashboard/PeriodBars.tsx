import cx from 'classnames';
import type { SummaryBar } from '@/services/summaries';
import { fmt } from '@/lib/format';
import styles from './Dashboard.module.css';

/** Week view: daily-log spending per day. Days still to come are empty dashed boxes. */
export function WeekBars({ bars, today, label }: { bars: SummaryBar[]; today: number; label: string }) {
    const max = Math.max(1, ...bars.map(b => b.daily));
    return (
        <div className={styles.panel} data-testid="period-bars">
            <div className={styles.panelHead}>
                <span>SPENDING BY DAY · {label}</span>
                <span className={styles.legend}><span className={styles.legendCell} style={{ background: 'var(--primary)' }} /> DAILY SPEND</span>
            </div>
            <div className={styles.barChart} style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }}>
                {bars.map(b => {
                    const future = b.start > today;
                    return (
                        <div key={b.start} className={cx(styles.barSlot, future && styles.barFuture)} title={`${b.label} · $${fmt(b.daily)}`}>
                            {!future && b.daily > 0 && (
                                <span className={styles.bar} style={{ height: `${(b.daily / max) * 100}%`, background: b.start === today ? 'var(--primary)' : 'var(--heat-3)' }} />
                            )}
                        </div>
                    );
                })}
            </div>
            <div className={styles.barLabels} style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }}>
                {bars.map(b => <span key={b.start} style={{ color: b.start === today ? 'var(--primary)' : undefined }}>{b.label}</span>)}
            </div>
            <span className={styles.note}>WEEK VIEW SHOWS DAILY-LOG SPENDING ONLY</span>
        </div>
    );
}

/** Quarter and year views: income vs spending (fixed + daily) per month */
export function IncomeBars({ bars, today, label }: { bars: SummaryBar[]; today: number; label: string }) {
    const spend = (b: SummaryBar) => (b.fixed ?? 0) + b.daily;
    const max = Math.max(1, ...bars.map(b => Math.max(b.income ?? 0, spend(b))));
    return (
        <div className={styles.panel} data-testid="period-bars">
            <div className={styles.panelHead}>
                <span>INCOME VS SPENDING · {label}</span>
                <span className={styles.legend}>
                    <span className={styles.legendCell} style={{ background: 'var(--income)' }} /> INCOME
                    <span className={styles.legendCell} style={{ background: 'var(--primary)', marginLeft: 10 }} /> SPENDING
                </span>
            </div>
            <div className={styles.barChart} style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }}>
                {bars.map(b => {
                    const future = b.start > today;
                    const current = b.start <= today && today <= b.end;
                    const title = `${b.label} · income $${fmt(b.income ?? 0)} · spending $${fmt(spend(b))}${b.budgeted ? '' : ' · no saved budget'}`;
                    return (
                        <div key={b.start} className={cx(styles.barSlot, styles.barPair, future && styles.barFuture, current && styles.barCurrent)} title={title}>
                            {!future && (
                                <>
                                    <span className={styles.bar} style={{ height: `${((b.income ?? 0) / max) * 100}%`, background: 'var(--income)' }} />
                                    <span className={styles.bar} style={{ height: `${(spend(b) / max) * 100}%`, background: 'var(--primary)' }} />
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className={styles.barLabels} style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }}>
                {bars.map(b => {
                    const current = b.start <= today && today <= b.end;
                    return <span key={b.start} style={{ color: current ? 'var(--primary)' : b.start > today ? 'var(--faint)' : undefined }}>{b.label}</span>;
                })}
            </div>
            <span className={styles.note}>SPENDING = FIXED FROM BUDGET + DAILY LOG</span>
        </div>
    );
}
