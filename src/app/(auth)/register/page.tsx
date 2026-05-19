'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Mail from '@/common/icons/Mail';
import Eye from '@/common/icons/Eye';
import EyeOff from '@/common/icons/EyeOff';
import styles from './Register.module.css';

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
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
            <h1 className={styles.title}>Create account</h1>
            <p className={styles.subtitle}>Sign up for Spendly</p>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                    <label className={styles.label}>Name</label>
                    <div className={styles.inputWrap}>
                        <input
                            className={styles.input}
                            type="text"
                            placeholder="Your full name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>
                </div>

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
                            placeholder="Create a password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            minLength={8}
                            required
                        />
                        <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(p => !p)}>
                            {showPassword ? <EyeOff /> : <Eye />}
                        </button>
                    </div>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Confirm Password</label>
                    <div className={styles.inputWrap}>
                        <input
                            className={styles.input}
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="Confirm your password"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            required
                        />
                        <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm(p => !p)}>
                            {showConfirm ? <EyeOff /> : <Eye />}
                        </button>
                    </div>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button className={styles.submit} type="submit" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create account'}
                </button>
            </form>

            <p className={styles.footer}>
                Already have an account?{' '}
                <Link href="/login" className={styles.link}>Sign in</Link>
            </p>
        </div>
    );
}
