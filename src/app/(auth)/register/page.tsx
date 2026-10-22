'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import cx from 'classnames';
import AuthField from '../AuthField';
import styles from '../Auth.module.css';

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (loading) return;
        setError('');

        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Registration failed');
                setLoading(false);
                return;
            }

            router.push('/dashboard');
        } catch {
            setError('Something went wrong. Please try again.');
            setLoading(false);
        }
    }

    const edit = (set: (v: string) => void) => (v: string) => { set(v); setError(''); };

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.heading}>
                <h2 className={styles.title}>Create account</h2>
                <p className={styles.subtitle}>Sign up for Spendly.</p>
            </div>

            <AuthField
                label="NAME" type="text" value={name} onChange={edit(setName)}
                placeholder="Your full name" autoComplete="name" invalid={!!error}
            />
            <AuthField
                label="EMAIL" type="email" value={email} onChange={edit(setEmail)}
                placeholder="you@example.com" autoComplete="email" invalid={!!error}
            />
            <AuthField
                label="PASSWORD" hint="MIN 8 CHARACTERS" type="password" value={password} onChange={edit(setPassword)}
                placeholder="Create a password" autoComplete="new-password" invalid={!!error} minLength={8}
            />
            <AuthField
                label="CONFIRM PASSWORD" type="password" value={confirm} onChange={edit(setConfirm)}
                placeholder="Repeat your password" autoComplete="new-password" invalid={!!error}
            />

            {error && <p className={styles.error} role="alert">✕ {error}</p>}

            <button className={cx(styles.submit, loading && styles.submitBusy)} type="submit" disabled={loading}>
                {loading ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT →'}
            </button>

            <p className={styles.switch}>
                Already have an account? <Link href="/login" className={styles.switchLink}>SIGN IN →</Link>
            </p>
        </form>
    );
}
