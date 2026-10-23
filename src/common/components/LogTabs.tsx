'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import cx from 'classnames';
import styles from './LogTabs.module.css';

const TABS = [
    { href: '/daily-log', label: 'WEEK' },
    { href: '/daily-log/all', label: 'ALL EXPENSES' },
];

/** Week | All expenses, at the top of both Daily Log pages */
export default function LogTabs() {
    const pathname = usePathname();
    return (
        <nav className={styles.tabs} aria-label="Daily log views">
            {TABS.map(t => (
                <Link
                    key={t.href}
                    href={t.href}
                    className={cx(styles.tab, pathname === t.href && styles.active)}
                    aria-current={pathname === t.href ? 'page' : undefined}
                >
                    {t.label}
                </Link>
            ))}
        </nav>
    );
}
