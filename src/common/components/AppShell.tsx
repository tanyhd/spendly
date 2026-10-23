'use client';

import { useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import cx from 'classnames';
import { useAuth } from '@/context/AuthContext';
import { useExpense } from '@/context/ExpenseContext';
import { useNavigationGuard } from '@/context/NavigationGuardContext';
import { initials } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { isTyping } from '@/lib/input';
import styles from './AppShell.module.css';

const NAV = [
    { href: '/dashboard', label: 'DASHBOARD', tab: 'DASH' },
    { href: '/daily-log', label: 'DAILY LOG', tab: 'LOG' },
    { href: '/monthly-budget', label: 'BUDGET', tab: 'BUDGET' },
    { href: '/annual-overview', label: 'ANNUAL', tab: 'YEAR' },
    { href: '/settings', label: 'SETTINGS', tab: 'SET' },
];

export default function AppShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { openAdd, isOpen: sheetOpen } = useExpense();
    const { leave } = useNavigationGuard();
    const { theme, toggle: toggleTheme } = useTheme();
    // The menu belongs to the page it was opened on, so navigating closes it
    const [menuPath, setMenuPath] = useState<string | null>(null);
    const menuOpen = menuPath === pathname;
    const setMenuOpen = (open: boolean) => setMenuPath(open ? pathname : null);

    const current = NAV.find(n => pathname.startsWith(n.href));
    const userInitials = initials(user?.name);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') return setMenuPath(null);
            if (isTyping(e.target)) return;
            if (sheetOpen || e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                openAdd();
                return;
            }
            const n = NAV[parseInt(e.key, 10) - 1];
            if (n && !pathname.startsWith(n.href)) leave(() => router.push(n.href));
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [openAdd, router, sheetOpen, leave, pathname]);

    return (
        <div className={styles.shell}>
            {/* Desktop command bar */}
            <header className={cx(styles.bar, styles.desktopOnly)}>
                <div className={styles.brand}><span className={styles.mark} />SPENDLY</div>
                <nav className={styles.nav}>
                    {NAV.map((n, i) => (
                        <Link key={n.href} href={n.href} className={cx(styles.navItem, current === n && styles.navActive)}>
                            <span className={styles.navNum}>{i + 1}</span>{n.label}
                        </Link>
                    ))}
                </nav>
                <button className={styles.addBtn} onClick={() => openAdd()}>
                    + ADD EXPENSE <span className={styles.key}>N</span>
                </button>
                <button
                    className={cx(styles.avatar, menuOpen && styles.avatarOpen)}
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Account menu"
                >
                    {userInitials}
                </button>
            </header>

            {/* Phone title bar */}
            <header className={cx(styles.bar, styles.phoneOnly)}>
                <div className={styles.phoneTitle}><span className={styles.mark} />{pathname === '/daily-log/all' ? 'ALL EXPENSES' : current?.label ?? 'SPENDLY'}</div>
                <button
                    className={cx(styles.avatar, styles.avatarPhone, menuOpen && styles.avatarOpen)}
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Account menu"
                >
                    {userInitials}
                </button>
            </header>

            <main className={styles.main}>{children}</main>

            {/* Phone tab bar */}
            <nav className={cx(styles.tabbar, styles.phoneOnly)}>
                {NAV.slice(0, 2).map(n => (
                    <Link key={n.href} href={n.href} className={cx(styles.tab, current === n && styles.tabActive)}>{n.tab}</Link>
                ))}
                <button className={styles.tabAdd} onClick={() => openAdd()} aria-label="Add expense">+</button>
                {NAV.slice(2, 4).map(n => (
                    <Link key={n.href} href={n.href} className={cx(styles.tab, current === n && styles.tabActive)}>{n.tab}</Link>
                ))}
            </nav>

            {menuOpen && (
                <>
                    <div className={styles.menuOverlay} onClick={() => setMenuOpen(false)} />
                    <div className={styles.menu}>
                        <div className={styles.menuHead}>
                            <span className={styles.menuInitials}>{userInitials}</span>
                            <div className={styles.menuWho}>
                                <span className={styles.menuName}>{user?.name}</span>
                                <span className={styles.menuEmail}>{user?.email}</span>
                            </div>
                        </div>
                        <Link href="/settings" className={cx(styles.menuItem, styles.phoneOnlyBlock)}>SETTINGS</Link>
                        <button className={cx(styles.menuItem, styles.menuSplit)} onClick={toggleTheme}>
                            <span>APPEARANCE</span>
                            <span className={styles.menuHint}>{theme === 'light' ? 'LIGHT · SWITCH TO DARK' : 'DARK · SWITCH TO LIGHT'}</span>
                        </button>
                        <button className={cx(styles.menuItem, styles.signOut)} onClick={() => { setMenuOpen(false); leave(logout); }}>SIGN OUT</button>
                    </div>
                </>
            )}
        </div>
    );
}
