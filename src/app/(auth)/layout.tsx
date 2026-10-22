import BrandPanel from './BrandPanel';
import styles from './Auth.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className={styles.page}>
            <BrandPanel />
            <section className={styles.formPanel}>{children}</section>
        </main>
    );
}
