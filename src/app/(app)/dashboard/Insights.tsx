import type { Insight } from '@/lib/insights';
import styles from './Dashboard.module.css';

/** 1–3 plain sentences under the KPIs: "Heads up" for things to act on, "Good news" otherwise */
export default function Insights({ items }: { items: Insight[] }) {
    if (items.length === 0) return null;
    return (
        <div className={styles.insights} style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }} data-testid="insights">
            {items.map((i, n) => {
                const good = i.tone === 'good';
                return (
                    <div key={n} className={styles.insight}>
                        <span className={styles.insightTag} style={{ color: good ? 'var(--pos)' : 'var(--primary)' }}>
                            <span className={styles.dot} style={{ background: good ? 'var(--pos)' : 'var(--primary)' }} />
                            {good ? 'GOOD NEWS' : 'HEADS UP'}
                        </span>
                        <span className={styles.insightText}>{i.text}</span>
                    </div>
                );
            })}
        </div>
    );
}
