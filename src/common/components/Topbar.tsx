'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Settings from '@/common/icons/Settings';
import Logout from '@/common/icons/Logout';
import styles from './Topbar.module.css';

export default function Topbar() {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className={styles.topbar}>
            <div className={styles.right}>
                <div className={styles.avatarWrap} ref={ref}>
                    <div className={styles.avatar} onClick={() => setOpen(o => !o)}>
                        {initials}
                    </div>
                    {open && (
                        <div className={styles.dropdown}>
                            {user && (
                                <div className={styles.dropdownHeader}>
                                    <p className={styles.dropdownName}>{user.name}</p>
                                    <p className={styles.dropdownEmail}>{user.email}</p>
                                </div>
                            )}
                            <Link href="/settings" className={styles.dropdownItem} onClick={() => setOpen(false)}>
                                <Settings width="15" height="15" />
                                Settings
                            </Link>
                            <button className={styles.dropdownItem} onClick={logout}>
                                <Logout width="15" height="15" />
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
