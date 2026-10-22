import styles from './SegmentBar.module.css';

type Props = {
    /** 0–100, or null when there's no income to measure against */
    rate: number | null;
    /** Tint the empty segments red (spent more than earned) */
    negative?: boolean;
    segments?: number;
};

/** Savings-rate meter: 20 blocks, each worth 5% */
export default function SegmentBar({ rate, negative = false, segments = 20 }: Props) {
    const filled = rate === null ? 0 : Math.round(rate / (100 / segments));
    return (
        <div className={styles.bar} style={{ gridTemplateColumns: `repeat(${segments}, 1fr)` }} aria-hidden="true">
            {Array.from({ length: segments }, (_, i) => (
                <span key={i} className={i < filled ? styles.on : negative ? styles.neg : styles.off} />
            ))}
        </div>
    );
}
