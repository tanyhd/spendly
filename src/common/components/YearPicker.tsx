'use client';

import { useState, useEffect, useRef } from 'react';
import cx from 'classnames';
import styles from './YearPicker.module.css';

type Props = {
    year: number;
    onChange: (year: number) => void;
};

export default function YearPicker({ year, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const [decadeStart, setDecadeStart] = useState(() => Math.floor(year / 10) * 10);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        setDecadeStart(Math.floor(year / 10) * 10);
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open, year]);

    const decadeYears = Array.from({ length: 10 }, (_, i) => decadeStart + i);

    return (
        <div className={styles.wrap} ref={ref}>
            <div className={styles.nav}>
                <button className={styles.navBtn} onClick={() => onChange(year - 1)}>&#8249;</button>
                <button className={styles.label} onClick={() => setOpen(o => !o)}>
                    {year}
                </button>
                <button className={styles.navBtn} onClick={() => onChange(year + 1)}>&#8250;</button>
            </div>
            {open && (
                <div className={styles.picker}>
                    <div className={styles.decadeRow}>
                        <button className={styles.decadeBtn} onClick={() => setDecadeStart(d => d - 10)}>&#8249;</button>
                        <span className={styles.decadeLabel}>{decadeStart} – {decadeStart + 9}</span>
                        <button className={styles.decadeBtn} onClick={() => setDecadeStart(d => d + 10)}>&#8250;</button>
                    </div>
                    <div className={styles.grid}>
                        {decadeYears.map(y => (
                            <button
                                key={y}
                                className={cx(styles.year, y === year && styles.yearActive)}
                                onClick={() => { onChange(y); setOpen(false); }}
                            >
                                {y}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
