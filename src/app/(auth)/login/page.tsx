'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import cx from 'classnames';
import AuthField from '../AuthField';
import styles from '../Auth.module.css';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (loading) return;
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Login failed');
                setLoading(false);
                return;
            }

            const settings = await fetch('/api/settings').then(r => r.ok ? r.json() : null);
            const defaultPage = settings?.defaultPage || 'dashboard';
            router.push(`/${defaultPage}`);
        } catch {
            setError('Something went wrong. Please try again.');
            setLoading(false);
        }
    }

    const edit = (set: (v: string) => void) => (v: string) => { set(v); setError(''); };

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.heading}>
                <h2 className={styles.title}>Welcome back</h2>
                <p className={styles.subtitle}>Sign in to your account.</p>
            </div>

            <AuthField
                label="EMAIL" type="email" value={email} onChange={edit(setEmail)}
                placeholder="you@example.com" autoComplete="email" invalid={!!error}
            />
            <AuthField
                label="PASSWORD" type="password" value={password} onChange={edit(setPassword)}
                placeholder="Your password" autoComplete="current-password" invalid={!!error}
            />

            {error && <p className={styles.error} role="alert">✕ {error}</p>}

            <button className={cx(styles.submit, loading && styles.submitBusy)} type="submit" disabled={loading}>
                {loading ? 'SIGNING IN…' : 'SIGN IN →'}
            </button>

            <p className={styles.switch}>
                No account yet? <Link href="/register" className={styles.switchLink}>CREATE ONE →</Link>
            </p>
        </form>
    );
}
