'use client';

import { useState, useEffect } from 'react';
import cx from 'classnames';
import styles from './Settings.module.css';
import { useAuth } from '@/context/AuthContext';
import WeekPicker from '@/common/components/WeekPicker';
import MonthPicker from '@/common/components/MonthPicker';

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}

function toDateInt(d: Date): number {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TABS = [
    { id: 'preferences', label: 'Preferences' },
    { id: 'data', label: 'Data Management' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function SettingsPage() {
    const now = new Date();
    const { refreshUser } = useAuth();

    const [activeTab, setActiveTab] = useState<TabId>('preferences');

    // Preferences
    const [displayName, setDisplayName] = useState('');
    const [defaultPage, setDefaultPage] = useState('dashboard');
    const [prefSaved, setPrefSaved] = useState(false);
    const [prefSaving, setPrefSaving] = useState(false);

    // Change Password
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwError, setPwError] = useState('');
    const [pwSaved, setPwSaved] = useState(false);
    const [pwSaving, setPwSaving] = useState(false);

    // Data Management
    const [clearWeekStart, setClearWeekStart] = useState(() => getWeekStart(now));
    const [clearWeekConfirm, setClearWeekConfirm] = useState(false);
    const [clearingWeek, setClearingWeek] = useState(false);
    const [clearYear, setClearYear] = useState(now.getFullYear());
    const [clearMonth, setClearMonth] = useState(now.getMonth() + 1);
    const [clearMonthConfirm, setClearMonthConfirm] = useState(false);
    const [clearAllConfirm, setClearAllConfirm] = useState('');
    const [clearingMonth, setClearingMonth] = useState(false);
    const [clearingAll, setClearingAll] = useState(false);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.json())
            .then(data => {
                if (data.displayName !== undefined) setDisplayName(data.displayName);
                if (data.defaultPage) setDefaultPage(data.defaultPage);
            })
            .finally(() => setLoading(false));
    }, []);

    async function handleSavePreferences() {
        setPrefSaving(true);
        await fetch('/api/settings/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName, defaultPage }),
        });
        await refreshUser();
        setPrefSaving(false);
        setPrefSaved(true);
        setTimeout(() => setPrefSaved(false), 2000);
    }

    async function handleChangePassword() {
        setPwError('');
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPwError('All fields are required.');
            return;
        }
        if (newPassword.length < 8) {
            setPwError('New password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwError('New passwords do not match.');
            return;
        }
        setPwSaving(true);
        const res = await fetch('/api/settings/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json();
        setPwSaving(false);
        if (!res.ok) {
            setPwError(data.message || 'Failed to change password.');
            return;
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPwSaved(true);
        setTimeout(() => setPwSaved(false), 2000);
    }

    async function handleClearWeek() {
        setClearingWeek(true);
        const weekEnd = new Date(clearWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        await fetch('/api/settings/data', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'week', weekStart: toDateInt(clearWeekStart), weekEnd: toDateInt(weekEnd) }),
        });
        setClearingWeek(false);
        setClearWeekConfirm(false);
    }

    async function handleClearMonth() {
        setClearingMonth(true);
        await fetch('/api/settings/data', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'month', year: clearYear, month: clearMonth }),
        });
        setClearingMonth(false);
        setClearMonthConfirm(false);
    }

    async function handleClearAll() {
        if (clearAllConfirm !== 'DELETE') return;
        setClearingAll(true);
        await fetch('/api/settings/data', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'all' }),
        });
        setClearingAll(false);
        setClearAllConfirm('');
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className="pageTitle">Settings</h1>
                <p className="pageSubtitle">Manage your preferences and data.</p>
            </div>

            <div className={styles.tabs}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={cx(styles.tab, activeTab === tab.id && styles.tabActive)}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <p className={styles.loading}>Loading…</p>
            ) : (
                <>
                    {/* ── Preferences Tab ── */}
                    {activeTab === 'preferences' && (
                        <div className={styles.card}>
                            <div className={styles.cardTitleRow}>
                                <div>
                                    <div className={styles.cardTitle}>Preferences</div>
                                    <p className={styles.cardSubtitle}>Personalise your Spendly experience.</p>
                                </div>
                                <button
                                    className={cx(styles.saveBtn, prefSaved && styles.saveBtnSaved)}
                                    onClick={handleSavePreferences}
                                    disabled={prefSaving}
                                >
                                    {prefSaved ? 'Saved!' : 'Save'}
                                </button>
                            </div>
                            <div className={styles.prefGrid}>
                                <div className={styles.prefFieldGroup}>
                                    <label className={styles.prefLabel}>Display Name</label>
                                    <input
                                        className={styles.prefInput}
                                        placeholder="Your name"
                                        value={displayName}
                                        onChange={e => setDisplayName(e.target.value)}
                                    />
                                </div>
                                <div className={styles.prefFieldGroup}>
                                    <label className={styles.prefLabel}>Default Page</label>
                                    <div className={styles.radioGroup}>
                                        {[
                                            { value: 'dashboard', label: 'Dashboard' },
                                            { value: 'monthly-budget', label: 'Monthly Budget' },
                                            { value: 'daily-log', label: 'Daily Log' },
                                            { value: 'annual-overview', label: 'Annual Overview' },
                                        ].map(opt => (
                                            <label key={opt.value} className={styles.radioLabel}>
                                                <input
                                                    type="radio"
                                                    className={styles.radioInput}
                                                    name="defaultPage"
                                                    value={opt.value}
                                                    checked={defaultPage === opt.value}
                                                    onChange={() => setDefaultPage(opt.value)}
                                                />
                                                {opt.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Change Password Card ── */}
                    {activeTab === 'preferences' && (
                        <div className={styles.card}>
                            <div className={styles.cardTitleRow}>
                                <div>
                                    <div className={styles.cardTitle}>Change Password</div>
                                    <p className={styles.cardSubtitle}>Update your account password.</p>
                                </div>
                                <button
                                    className={cx(styles.saveBtn, pwSaved && styles.saveBtnSaved)}
                                    onClick={handleChangePassword}
                                    disabled={pwSaving}
                                >
                                    {pwSaved ? 'Updated!' : 'Update'}
                                </button>
                            </div>
                            <div className={styles.prefGrid}>
                                <div className={styles.prefFieldGroup}>
                                    <label className={styles.prefLabel}>Current Password</label>
                                    <input
                                        className={styles.prefInput}
                                        type="password"
                                        placeholder="Enter current password"
                                        value={currentPassword}
                                        onChange={e => { setCurrentPassword(e.target.value); setPwError(''); }}
                                    />
                                </div>
                                <div className={styles.prefFieldGroup}>
                                    <label className={styles.prefLabel}>New Password</label>
                                    <input
                                        className={styles.prefInput}
                                        type="password"
                                        placeholder="At least 8 characters"
                                        value={newPassword}
                                        onChange={e => { setNewPassword(e.target.value); setPwError(''); }}
                                    />
                                </div>
                                <div className={styles.prefFieldGroup}>
                                    <label className={styles.prefLabel}>Confirm New Password</label>
                                    <input
                                        className={styles.prefInput}
                                        type="password"
                                        placeholder="Repeat new password"
                                        value={confirmPassword}
                                        onChange={e => { setConfirmPassword(e.target.value); setPwError(''); }}
                                    />
                                </div>
                                {pwError && <p style={{ color: '#EF4444' }}>{pwError}</p>}
                            </div>
                        </div>
                    )}

                    {/* ── Data Management Tab ── */}
                    {activeTab === 'data' && (
                        <div className={styles.dataGrid}>
                            <div className={styles.card}>
                                <div className={styles.cardTitle}>Clear Week Data</div>
                                <p className={styles.cardSubtitle}>Delete all daily entries for a specific week.</p>
                                <div className={styles.clearMonthRow}>
                                    <WeekPicker weekStart={clearWeekStart} onChange={w => { setClearWeekStart(w); setClearWeekConfirm(false); }} />
                                    {!clearWeekConfirm ? (
                                        <button className={styles.dangerBtn} onClick={() => setClearWeekConfirm(true)}>
                                            Clear Week
                                        </button>
                                    ) : (
                                        <>
                                            <span style={{ color: 'var(--text-muted)' }}>Delete this week?</span>
                                            <button className={styles.dangerBtnStrong} onClick={handleClearWeek} disabled={clearingWeek}>
                                                {clearingWeek ? 'Clearing…' : 'Confirm'}
                                            </button>
                                            <button className={styles.cancelBtn} onClick={() => setClearWeekConfirm(false)}>
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className={styles.card}>
                                <div className={styles.cardTitle}>Clear Month Data</div>
                                <p className={styles.cardSubtitle}>Delete all daily entries and the monthly budget plan for a specific month.</p>
                                <div className={styles.clearMonthRow}>
                                    <MonthPicker
                                        year={clearYear}
                                        month={clearMonth}
                                        onChange={(y, m) => { setClearYear(y); setClearMonth(m); setClearMonthConfirm(false); }}
                                    />
                                    {!clearMonthConfirm ? (
                                        <button
                                            className={styles.dangerBtn}
                                            onClick={() => setClearMonthConfirm(true)}
                                        >
                                            Clear Month
                                        </button>
                                    ) : (
                                        <>
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                Delete {MONTHS_SHORT[clearMonth - 1]} {clearYear}?
                                            </span>
                                            <button
                                                className={styles.dangerBtnStrong}
                                                onClick={handleClearMonth}
                                                disabled={clearingMonth}
                                            >
                                                {clearingMonth ? 'Clearing…' : 'Confirm'}
                                            </button>
                                            <button
                                                className={styles.cancelBtn}
                                                onClick={() => setClearMonthConfirm(false)}
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className={cx(styles.card, styles.dangerCard)}>
                                <div className={styles.cardTitle}>Danger Zone</div>
                                <div className={styles.dangerZone}>
                                    <p className={styles.dangerWarning}>
                                        <strong>Permanently delete</strong> all your daily entries and monthly budget plans. This cannot be undone.
                                    </p>
                                    <div className={styles.clearAllRow}>
                                        <input
                                            className={styles.dangerInput}
                                            placeholder='Type "DELETE" to confirm'
                                            value={clearAllConfirm}
                                            onChange={e => setClearAllConfirm(e.target.value)}
                                        />
                                        <button
                                            className={styles.dangerBtnStrong}
                                            onClick={handleClearAll}
                                            disabled={clearAllConfirm !== 'DELETE' || clearingAll}
                                        >
                                            {clearingAll ? 'Deleting…' : 'Delete All Data'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
