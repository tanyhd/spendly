'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Mail from '@/common/icons/Mail';
import Eye from '@/common/icons/Eye';
import EyeOff from '@/common/icons/EyeOff';
import styles from './Login.module.css';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
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
                return;
            }

            router.push('/dashboard');
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={styles.card}>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>Sign in to your account</p>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                    <label className={styles.label}>Email</label>
                    <div className={styles.inputWrap}>
                        <input
                            className={styles.input}
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                        <span className={styles.inputIcon}>
                            <Mail />
                        </span>
                    </div>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Password</label>
                    <div className={styles.inputWrap}>
                        <input
                            className={styles.input}
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Your password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                        <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(p => !p)}>
                            {showPassword ? <EyeOff /> : <Eye />}
                        </button>
                    </div>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button className={styles.submit} type="submit" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>

            <p className={styles.footer}>
                Don&apos;t have an account?{' '}
                <Link href="/register" className={styles.link}>Register</Link>
            </p>
        </div>
    );
}
