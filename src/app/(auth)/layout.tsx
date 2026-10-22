import styles from './Auth.module.css';

const LEVELS = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'];
const PATTERN = [0, 1, 0, 2, 1, 0, 3, 1, 0, 2, 4, 1, 0, 1];

// Decorative 14×3 heatmap, same pattern as the wireframe
const MOTIF = Array.from({ length: 42 }, (_, i) =>
    LEVELS[PATTERN[i % 14] * (i % 3 === 0 ? 1 : 0) || (i * 7 % 5 === 0 ? 2 : i % 4 === 0 ? 1 : 0)]
);

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className={styles.page}>
            <section className={styles.brandPanel}>
                <div className={styles.brand}><span className={styles.mark} />SPENDLY</div>
                <div className={styles.hero}>
                    <h1 className={styles.heroText}>
                        Track your expenses and plan your budget.<span className={styles.cursor}>_</span>
                    </h1>
                    <div className={styles.motif} aria-hidden="true">
                        {MOTIF.map((c, i) => <span key={i} style={{ background: c }} />)}
                    </div>
                </div>
                <span className={styles.tagline}>BUDGET · DAILY LOG · ANNUAL REVIEW</span>
            </section>
            <section className={styles.formPanel}>{children}</section>
        </main>
    );
}
