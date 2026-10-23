import cx from 'classnames';
import type { SummaryCategory } from '@/services/summaries';
import type { Period } from '@/lib/period';
import { dailyCategory } from '@/common/constants/categories';
import CategoryTag from '@/common/components/CategoryTag';
import { fmt } from '@/lib/format';
import styles from './Dashboard.module.css';

type Props = {
    period: Period;
    rows: SummaryCategory[];
    timing: 'past' | 'current' | 'future';
    hasCompare: boolean;
};

/** Daily spending per category, with the change against the previous period */
export default function ByCategory({ period, rows, timing, hasCompare }: Props) {
    const against = !hasCompare ? '' : timing === 'current' ? `VS SAME POINT LAST ${period.toUpperCase()}` : `VS LAST ${period.toUpperCase()}`;
    return (
        <div className={cx(styles.panel, styles.byCat)} data-testid="by-category">
            <div className={styles.panelHead}><span>BY CATEGORY</span><span>{against}</span></div>
            {rows.length === 0 && <span className={styles.empty}>No daily spending in this {period}.</span>}
            {rows.map(r => {
                const isNew = r.prevSpent === 0 && r.spent > 0;
                const up = (r.change ?? 0) > 0;
                const pct = r.prevSpent ? Math.round((Math.abs(r.change ?? 0) / r.prevSpent) * 100) : null;
                return (
                    <div key={r.category} className={styles.byCatRow}>
                        <span className={styles.byCatName}><CategoryTag category={dailyCategory(r.category)} />{r.category}</span>
                        <span className={cx(styles.byCatAmt, 'num')}>{fmt(r.spent)}</span>
                        {r.prevSpent === null ? <span /> : isNew ? (
                            <span className={styles.byCatChange} style={{ color: 'var(--muted)' }}>NEW</span>
                        ) : r.change === 0 ? (
                            <span className={styles.byCatChange} style={{ color: 'var(--dim)' }}>SAME</span>
                        ) : (
                            <span className={cx(styles.byCatChange, 'num')} style={{ color: up ? 'var(--neg)' : 'var(--pos)' }}>
                                <span className={styles.arrow} aria-hidden="true">{up ? '▲' : '▼'}</span> {pct}% {up ? '+' : '−'}{fmt(Math.abs(r.change ?? 0))}
                            </span>
                        )}
                        <span className={cx(styles.byCatWas, 'num')}>
                            {r.prevSpent === null ? '' : isNew ? 'NEW' : `WAS ${fmt(r.prevSpent)}`}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
