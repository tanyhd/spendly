'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import cx from 'classnames';
import { useAuth } from '@/context/AuthContext';
import { fmt, fmtMonth, fmtWeekRange, getWeekStart, plural, toDateInt } from '@/lib/format';
import styles from './Settings.module.css';

const TABS = [
    { id: 'preferences', label: 'PREFERENCES' },
    { id: 'data', label: 'DATA MANAGEMENT' },
] as const;
type TabId = typeof TABS[number]['id'];

const PAGES = [
    { value: 'dashboard', label: 'DASHBOARD' },
    { value: 'monthly-budget', label: 'MONTHLY BUDGET' },
    { value: 'daily-log', label: 'DAILY LOG' },
    { value: 'annual-overview', label: 'ANNUAL OVERVIEW' },
];

type Preview = { entries: number; total: number; budgets: number };
type Status = 'idle' | 'saving' | 'done';

function weekEndOf(ws: Date): Date {
    const d = new Date(ws);
    d.setDate(d.getDate() + 6);
    return d;
}

function useTimedReset(setter: (s: Status) => void) {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
    return () => {
        setter('done');
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setter('idle'), 2000);
    };
}

function Stepper({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
    return (
        <div className={styles.stepper}>
            <button className={styles.stepBtn} onClick={onPrev} aria-label="Previous">‹</button>
            <span className={styles.stepLabel}>{label}</span>
            <button className={styles.stepBtn} onClick={onNext} aria-label="Next">›</button>
        </div>
    );
}

export default function SettingsPage() {
    const now = new Date();
    const { refreshUser } = useAuth();
    const [activeTab, setActiveTab] = useState<TabId>('preferences');
    const [loading, setLoading] = useState(true);

    // Preferences
    const [registeredName, setRegisteredName] = useState('');
    const [saved, setSaved] = useState({ displayName: '', defaultPage: 'dashboard' });
    const [displayName, setDisplayName] = useState('');
    const [defaultPage, setDefaultPage] = useState('dashboard');
    const [prefStatus, setPrefStatus] = useState<Status>('idle');
    const prefDone = useTimedReset(setPrefStatus);

    // Change password
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwError, setPwError] = useState('');
    const [pwStatus, setPwStatus] = useState<Status>('idle');
    const pwDone = useTimedReset(setPwStatus);

    // Data management
    const [clearWeekStart, setClearWeekStart] = useState(() => getWeekStart(now));
    const [clearYear, setClearYear] = useState(now.getFullYear());
    const [clearMonth, setClearMonth] = useState(now.getMonth() + 1);
    const [confirming, setConfirming] = useState<'week' | 'month' | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ week?: string; month?: string; all?: string }>({});
    const [weekPreview, setWeekPreview] = useState<Preview | null>(null);
    const [monthPreview, setMonthPreview] = useState<Preview | null>(null);
    const [allPreview, setAllPreview] = useState<Preview | null>(null);
    const [clearAllConfirm, setClearAllConfirm] = useState('');
    const [reload, setReload] = useState(0);

    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.json())
            .then(data => {
                const s = { displayName: data.displayName ?? '', defaultPage: data.defaultPage || 'dashboard' };
                setSaved(s);
                setDisplayName(s.displayName);
                setDefaultPage(s.defaultPage);
                setRegisteredName(data.name ?? '');
            })
            .finally(() => setLoading(false));
    }, []);

    const weekStartInt = toDateInt(clearWeekStart);
    const weekEndInt = toDateInt(weekEndOf(clearWeekStart));

    useEffect(() => {
        if (activeTab !== 'data') return;
        const get = (q: string) => fetch(`/api/settings/data?${q}`).then(r => r.ok ? r.json() : null);
        get(`type=week&weekStart=${weekStartInt}&weekEnd=${weekEndInt}`).then(setWeekPreview);
    }, [activeTab, weekStartInt, weekEndInt, reload]);

    useEffect(() => {
        if (activeTab !== 'data') return;
        fetch(`/api/settings/data?type=month&year=${clearYear}&month=${clearMonth}`).then(r => r.ok ? r.json() : null).then(setMonthPreview);
    }, [activeTab, clearYear, clearMonth, reload]);

    useEffect(() => {
        if (activeTab !== 'data') return;
        fetch('/api/settings/data?type=all').then(r => r.ok ? r.json() : null).then(setAllPreview);
    }, [activeTab, reload]);

    const prefsDirty = prefStatus !== 'done' && (displayName !== saved.displayName || defaultPage !== saved.defaultPage);

    async function handleSavePreferences() {
        setPrefStatus('saving');
        await fetch('/api/settings/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName, defaultPage }),
        });
        await refreshUser();
        setSaved({ displayName, defaultPage });
        prefDone();
    }

    async function handleChangePassword(e: FormEvent) {
        e.preventDefault();
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
        setPwStatus('saving');
        const res = await fetch('/api/settings/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
            setPwStatus('idle');
            setPwError(data.message || 'Failed to change password.');
            return;
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        pwDone();
    }

    async function clearData(body: Record<string, unknown>) {
        setBusy(true);
        try {
            const res = await fetch('/api/settings/data', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            return res.ok ? await res.json() : null;
        } finally {
            setBusy(false);
            setConfirming(null);
            setReload(r => r + 1);
        }
    }

    async function handleClearWeek() {
        const label = fmtWeekRange(clearWeekStart);
        const r = await clearData({ type: 'week', weekStart: weekStartInt, weekEnd: weekEndInt });
        if (r) setDone({ week: `Cleared ${plural(r.deletedEntries, 'entry', 'entries')} from ${label}` });
    }

    async function handleClearMonth() {
        const label = fmtMonth(clearYear, clearMonth);
        const r = await clearData({ type: 'month', year: clearYear, month: clearMonth });
        if (r) setDone({ month: `Cleared ${plural(r.deletedEntries, 'entry', 'entries')}${r.deletedBudgets ? ' and the budget' : ''} for ${label}` });
    }

    async function handleClearAll() {
        if (clearAllConfirm !== 'DELETE') return;
        const r = await clearData({ type: 'all' });
        setClearAllConfirm('');
        if (r) setDone({ all: `Deleted ${plural(r.deletedEntries, 'entry', 'entries')} and ${plural(r.deletedBudgets, 'budget', 'budgets')}. Your account is still active.` });
    }

    function shiftWeek(delta: number) {
        const d = new Date(clearWeekStart);
        d.setDate(d.getDate() + delta * 7);
        setClearWeekStart(d);
        setConfirming(null);
    }

    function shiftMonth(delta: number) {
        const d = new Date(clearYear, clearMonth - 1 + delta, 1);
        setClearYear(d.getFullYear());
        setClearMonth(d.getMonth() + 1);
        setConfirming(null);
    }

    const weekLabel = fmtWeekRange(clearWeekStart);
    const monthLabel = fmtMonth(clearYear, clearMonth);
    const weekEmpty = !weekPreview || weekPreview.entries === 0;
    const monthEmpty = !monthPreview || (monthPreview.entries === 0 && monthPreview.budgets === 0);
    const allArmed = clearAllConfirm === 'DELETE';
    const fieldClass = cx(styles.input, pwError && styles.inputInvalid);

    return (
        <div className={styles.page}>
            <div className={styles.tabs}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={cx(styles.tab, activeTab === tab.id && styles.tabActive)}
                        onClick={() => { setActiveTab(tab.id); setConfirming(null); }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className={styles.loadingLine}>LOADING SETTINGS<span className={styles.cursor}>_</span></div>
            ) : activeTab === 'preferences' ? (
                <div className={styles.column}>
                    <section className={styles.block}>
                        <div className={styles.blockHead}>
                            <span className={styles.blockTitle}>PREFERENCES</span>
                            <span className={styles.blockDesc}>Personalise your Spendly experience.</span>
                        </div>
                        <label className={styles.field}>
                            <span className="label">Display name</span>
                            <input
                                className={styles.input}
                                placeholder={registeredName || 'Your name'}
                                value={displayName}
                                onChange={e => { setDisplayName(e.target.value); setPrefStatus('idle'); }}
                            />
                            <span className={styles.hint}>Shown in the account menu. Leave empty to use {registeredName || 'your registered name'}.</span>
                        </label>
                        <div className={styles.field}>
                            <span className="label">Open after sign-in</span>
                            <div className={styles.segments} role="radiogroup" aria-label="Open after sign-in">
                                {PAGES.map(p => (
                                    <button
                                        key={p.value}
                                        role="radio"
                                        aria-checked={defaultPage === p.value}
                                        className={cx(styles.segment, defaultPage === p.value && styles.segmentActive)}
                                        onClick={() => { setDefaultPage(p.value); setPrefStatus('idle'); }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.actions}>
                            <button
                                className={cx(styles.primaryBtn, prefStatus === 'saving' && styles.btnBusy, prefStatus === 'done' && styles.btnDone)}
                                onClick={handleSavePreferences}
                                disabled={prefStatus === 'saving'}
                            >
                                {prefStatus === 'saving' ? 'SAVING…' : prefStatus === 'done' ? '✓ SAVED!' : 'SAVE PREFERENCES'}
                            </button>
                            {prefsDirty && <span className={styles.unsaved}>UNSAVED CHANGES</span>}
                        </div>
                    </section>

                    <form className={styles.block} onSubmit={handleChangePassword}>
                        <div className={styles.blockHead}>
                            <span className={styles.blockTitle}>CHANGE PASSWORD</span>
                            <span className={styles.blockDesc}>Update your account password.</span>
                        </div>
                        {[
                            { label: 'Current password', value: currentPassword, set: setCurrentPassword, ph: 'Enter current password', ac: 'current-password' },
                            { label: 'New password', value: newPassword, set: setNewPassword, ph: 'At least 8 characters', ac: 'new-password' },
                            { label: 'Confirm new password', value: confirmPassword, set: setConfirmPassword, ph: 'Repeat new password', ac: 'new-password' },
                        ].map(f => (
                            <label key={f.label} className={styles.field}>
                                <span className="label">{f.label}</span>
                                <input
                                    className={cx(fieldClass, styles.inputMono)}
                                    type="password"
                                    autoComplete={f.ac}
                                    placeholder={f.ph}
                                    value={f.value}
                                    onChange={e => { f.set(e.target.value); setPwError(''); setPwStatus('idle'); }}
                                />
                            </label>
                        ))}
                        {pwError && <span className={styles.error} role="alert">✕ {pwError}</span>}
                        <div className={styles.actions}>
                            <button
                                type="submit"
                                className={cx(styles.secondaryBtn, pwStatus === 'saving' && styles.btnBusy, pwStatus === 'done' && styles.btnDone)}
                                disabled={pwStatus === 'saving'}
                            >
                                {pwStatus === 'saving' ? 'UPDATING…' : pwStatus === 'done' ? '✓ UPDATED!' : 'UPDATE PASSWORD'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className={styles.column}>
                    {/* Clear week */}
                    <section className={styles.block}>
                        <div className={styles.blockHead}>
                            <span className={styles.blockTitle}>CLEAR WEEK</span>
                            <span className={styles.blockDesc}>Delete all daily entries for one week (Mon–Sun).</span>
                        </div>
                        <div className={styles.clearRow}>
                            <Stepper label={weekLabel} onPrev={() => shiftWeek(-1)} onNext={() => shiftWeek(1)} />
                            <button className={styles.dangerOutline} onClick={() => { setConfirming('week'); setDone({}); }} disabled={weekEmpty}>
                                CLEAR WEEK
                            </button>
                        </div>
                        <div className={styles.preview}>
                            <span className={styles.previewLabel}>WHAT GETS DELETED</span>
                            <span className={cx(weekEmpty && styles.previewDim)}>
                                {weekPreview ? `${plural(weekPreview.entries, 'daily entry', 'daily entries')} · ${fmt(weekPreview.total)}` : '…'}
                            </span>
                            <span className={styles.previewDim}>Budgets are not touched</span>
                        </div>
                        {confirming === 'week' && weekPreview && (
                            <div className={styles.confirm}>
                                <span className={styles.confirmText}>
                                    Delete {plural(weekPreview.entries, 'entry', 'entries')} (${fmt(weekPreview.total)}) from {weekLabel}? This can&apos;t be undone.
                                </span>
                                <button className={styles.confirmCancel} onClick={() => setConfirming(null)}>CANCEL</button>
                                <button className={styles.confirmYes} onClick={handleClearWeek} disabled={busy}>YES, CLEAR WEEK</button>
                            </div>
                        )}
                        {done.week && <span className={styles.success}>✓ {done.week}</span>}
                    </section>

                    {/* Clear month */}
                    <section className={styles.block}>
                        <div className={styles.blockHead}>
                            <span className={styles.blockTitle}>CLEAR MONTH</span>
                            <span className={styles.blockDesc}>Delete all daily entries and the saved budget for one month.</span>
                        </div>
                        <div className={styles.clearRow}>
                            <Stepper label={monthLabel} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />
                            <button className={styles.dangerOutline} onClick={() => { setConfirming('month'); setDone({}); }} disabled={monthEmpty}>
                                CLEAR MONTH
                            </button>
                        </div>
                        <div className={styles.preview}>
                            <span className={styles.previewLabel}>WHAT GETS DELETED</span>
                            <span className={cx(!monthPreview?.entries && styles.previewDim)}>
                                {monthPreview ? `${plural(monthPreview.entries, 'daily entry', 'daily entries')} · ${fmt(monthPreview.total)}` : '…'}
                            </span>
                            <span className={cx(!monthPreview?.budgets && styles.previewDim)}>
                                {monthPreview?.budgets ? `+ the saved ${monthLabel} budget (income & fixed rows)` : `No saved budget for ${monthLabel}`}
                            </span>
                        </div>
                        {confirming === 'month' && monthPreview && (
                            <div className={styles.confirm}>
                                <span className={styles.confirmText}>
                                    Delete {plural(monthPreview.entries, 'entry', 'entries')}{monthPreview.budgets ? ` and the ${monthLabel} budget` : ''}? This can&apos;t be undone.
                                </span>
                                <button className={styles.confirmCancel} onClick={() => setConfirming(null)}>CANCEL</button>
                                <button className={styles.confirmYes} onClick={handleClearMonth} disabled={busy}>YES, CLEAR MONTH</button>
                            </div>
                        )}
                        {done.month && <span className={styles.success}>✓ {done.month}</span>}
                    </section>

                    {/* Danger zone */}
                    <section className={styles.danger}>
                        <div className={styles.blockHead}>
                            <span className={cx(styles.blockTitle, styles.dangerTitle)}>DANGER ZONE · DELETE ALL DATA</span>
                            <span className={styles.dangerDesc}>
                                Permanently deletes <b>{allPreview ? plural(allPreview.entries, 'daily entry', 'daily entries') : '…'}</b> and <b>{allPreview ? plural(allPreview.budgets, 'monthly budget', 'monthly budgets') : '…'}</b>.
                                {' '}Your account, name and password stay. This cannot be undone.
                            </span>
                        </div>
                        <label className={styles.field}>
                            <span className="label">Type DELETE to confirm</span>
                            <input
                                className={cx(styles.input, styles.deleteInput, allArmed && styles.deleteInputArmed)}
                                placeholder="DELETE"
                                value={clearAllConfirm}
                                onChange={e => { setClearAllConfirm(e.target.value); setDone({}); }}
                            />
                        </label>
                        <button className={styles.dangerSolid} onClick={handleClearAll} disabled={!allArmed || busy}>
                            DELETE ALL DATA
                        </button>
                        {done.all && <span className={styles.success}>✓ {done.all}</span>}
                    </section>
                </div>
            )}
        </div>
    );
}
