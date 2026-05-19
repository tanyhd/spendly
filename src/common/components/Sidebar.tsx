'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import cx from 'classnames';
import { useAuth } from '@/context/AuthContext';
import Bank from '@/common/icons/Bank';
import Dashboard from '@/common/icons/Dashboard';
import DailyLog from '@/common/icons/DailyLog';
import MonthlyBudget from '@/common/icons/MonthlyBudget';
import AnnualOverview from '@/common/icons/AnnualOverview';
import Settings from '@/common/icons/Settings';
import Logout from '@/common/icons/Logout';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/dashboard', Icon: Dashboard },
    { label: 'Daily Log', href: '/daily-log', Icon: DailyLog },
    { label: 'Monthly Budget', href: '/monthly-budget', Icon: MonthlyBudget },
    { label: 'Annual Overview', href: '/annual-overview', Icon: AnnualOverview },
    { label: 'Settings', href: '/settings', Icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { logout } = useAuth();

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <Bank />
                <span className={styles.logoText}>SPENDLY</span>
            </div>

            <nav className={styles.nav}>
                {NAV_ITEMS.map(({ label, href, Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className={cx(styles.navItem, pathname.startsWith(href) && styles.active)}
                    >
                        <span className={styles.icon}><Icon /></span>
                        {label}
                    </Link>
                ))}
            </nav>

            <div className={styles.bottom}>
                <Link href="/daily-log" className={styles.addBtn}>+ Add Transaction</Link>
                <button className={styles.logoutBtn} onClick={logout}>
                    <Logout width="16" height="16" />
                    Logout
                </button>
            </div>
        </aside>
    );
}
