import type { CategoryProgress } from '@/lib/budgetProgress';
import { WARNING_PCT } from '@/lib/budgetProgress';
import styles from './LimitBar.module.css';

type Props = {
    /** null: no limit set (an empty track) */
    progress: Pick<CategoryProgress, 'pct' | 'status'> | null;
    /** The category's own colour, used while it's under the warning line */
    color: string;
};

/** Spent vs limit for one category, with a tick at the 80% warning line */
export default function LimitBar({ progress, color }: Props) {
    const pct = progress === null ? 0 : progress.pct === null ? (progress.status === 'over' ? 1 : 0) : Math.min(1, progress.pct);
    const fill = progress?.status === 'over' ? 'var(--neg)' : progress?.status === 'warning' ? 'var(--primary)' : color;
    return (
        <div className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={{ width: `${pct * 100}%`, background: fill }} />
            {progress && <span className={styles.tick} style={{ left: `${WARNING_PCT * 100}%` }} />}
        </div>
    );
}
