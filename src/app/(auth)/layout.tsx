import styles from './AuthLayout.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className={styles.bg}>
            {children}
        </main>
    );
}
