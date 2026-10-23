import Link from 'next/link';
import cx from 'classnames';
import { overText, type BudgetProgress } from '@/lib/budgetProgress';
import { dailyCategory } from '@/common/constants/categories';
import LimitBar from '@/common/components/LimitBar';
import SegmentBar from '@/common/components/SegmentBar';
import { fmt, plural } from '@/lib/format';
import styles from './Dashboard.module.css';

type Props = {
    budgets: BudgetProgress | null;
    /** Daily spending by category this month, so categories without a limit still show */
    spent: { category: string; total: number }[];
};

/** The month's category limits: what's left, $/day, and a bar per category */
export default function LeftToSpend({ budgets, spent }: Props) {
    if (!budgets) {
        return (
            <div className={styles.panel} data-testid="left-to-spend">
                <div className={styles.panelHead}><span>LEFT TO SPEND</span></div>
                <p className={styles.panelText}>
                    Set a monthly limit for the categories you want to watch, and see what&apos;s left to spend each day.
                </p>
                <Link href="/monthly-budget" className={styles.panelLink}>SET LIMITS →</Link>
            </div>
        );
    }

    const over = overText(budgets);
    const limited = new Set(budgets.byCategory.map(c => c.category));
    // Most used first; categories with spending but no limit go last
    const rows = [...budgets.byCategory].sort((a, b) => (b.pct ?? (b.spent > 0 ? Infinity : 0)) - (a.pct ?? (a.spent > 0 ? Infinity : 0)));
    const unlimited = spent.filter(s => !limited.has(s.category) && s.total > 0);

    return (
        <div className={styles.panel} data-testid="left-to-spend">
            <div className={styles.panelHead}>
                <span>LEFT TO SPEND</span>
                <span>{budgets.timing === 'current' ? `${plural(budgets.daysLeft, 'DAY', 'DAYS')} LEFT` : budgets.timing === 'past' ? 'FINAL' : 'NOT STARTED'}</span>
            </div>
            <span className={cx(styles.leftValue, 'num')}>{fmt(budgets.available)}</span>
            {/* Overspending in one category is shown on its own; it doesn't use up the others */}
            {over && <span className={styles.note} style={{ color: 'var(--neg)' }}>{over}</span>}
            <span className={styles.note}>
                {fmt(budgets.spent)} SPENT OF {fmt(budgets.totalLimit)} BUDGETED
                {budgets.unbudgetedSpent > 0 && ` · ${fmt(budgets.unbudgetedSpent)} UNBUDGETED`}
            </span>
            {budgets.timing === 'current' && budgets.dailyAllowance !== null && (
                <span className={styles.allowance}>${fmt(budgets.dailyAllowance)}/day for {plural(budgets.daysLeft, 'day', 'days')}</span>
            )}
            <SegmentBar
                segments={40}
                rate={budgets.totalLimit > 0 ? Math.min(100, (budgets.spent / budgets.totalLimit) * 100) : 100}
                color={budgets.left < 0 ? 'var(--neg)' : budgets.spent >= budgets.totalLimit * 0.8 ? 'var(--primary)' : 'var(--soft)'}
            />
            <div className={styles.limitList}>
                {rows.map(p => {
                    const c = dailyCategory(p.category);
                    const color = p.status === 'over' ? 'var(--neg)' : p.status === 'warning' ? 'var(--primary)' : 'var(--muted)';
                    return (
                        <div key={p.category} className={styles.limitRow}>
                            <span className={styles.catName}><span className={styles.swatch} style={{ background: c.color }} /><span className={styles.ellipsis}>{p.category.toUpperCase()}</span></span>
                            <LimitBar progress={p} color={c.color} />
                            <span className={cx(styles.limitOf, 'num')}>{Math.round(p.spent)}/{Math.round(p.limit)}</span>
                            <span className={styles.limitState} style={{ color }}>
                                {p.status === 'over' ? `OVER ${fmt(-p.left)}` : p.status === 'warning' ? `${Math.round((p.pct ?? 0) * 100)}% USED` : `${fmt(p.left)} LEFT`}
                            </span>
                        </div>
                    );
                })}
                {unlimited.map(s => {
                    const c = dailyCategory(s.category);
                    return (
                        <div key={s.category} className={styles.limitRow}>
                            <span className={styles.catName}><span className={styles.swatch} style={{ background: c.color }} /><span className={styles.ellipsis}>{s.category.toUpperCase()}</span></span>
                            <LimitBar progress={null} color={c.color} />
                            <span className={cx(styles.limitOf, 'num')}>{Math.round(s.total)}/–</span>
                            <span className={styles.limitState} style={{ color: 'var(--dim)' }}>NO LIMIT</span>
                        </div>
                    );
                })}
            </div>
            <Link href="/monthly-budget" className={styles.panelLink}>EDIT LIMITS →</Link>
        </div>
    );
}
