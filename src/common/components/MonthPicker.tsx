'use client';

import { useState, useEffect, useRef } from 'react';
import cx from 'classnames';
import styles from './MonthPicker.module.css';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

type Props = {
    year: number;
    month: number;
    onChange: (year: number, month: number) => void;
};

export default function MonthPicker({ year, month, onChange }: Props) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerYear, setPickerYear] = useState(year);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!pickerOpen) return;
        setPickerYear(year);
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setPickerOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [pickerOpen, year]);

    function prevMonth() {
        if (month === 1) onChange(year - 1, 12);
        else onChange(year, month - 1);
    }

    function nextMonth() {
        if (month === 12) onChange(year + 1, 1);
        else onChange(year, month + 1);
    }

    return (
        <div className={styles.wrap} ref={ref}>
            <div className={styles.nav}>
                <button className={styles.navBtn} onClick={prevMonth}>&#8249;</button>
                <button className={styles.label} onClick={() => setPickerOpen(o => !o)}>
                    {MONTHS[month - 1]} {year}
                </button>
                <button className={styles.navBtn} onClick={nextMonth}>&#8250;</button>
            </div>
            {pickerOpen && (
                <div className={styles.picker}>
                    <div className={styles.yearRow}>
                        <button className={styles.yearBtn} onClick={() => setPickerYear(y => y - 1)}>&#8249;</button>
                        <span className={styles.year}>{pickerYear}</span>
                        <button className={styles.yearBtn} onClick={() => setPickerYear(y => y + 1)}>&#8250;</button>
                    </div>
                    <div className={styles.grid}>
                        {MONTHS.map((m, i) => (
                            <button
                                key={m}
                                className={cx(
                                    styles.month,
                                    pickerYear === year && i + 1 === month && styles.monthActive
                                )}
                                onClick={() => { onChange(pickerYear, i + 1); setPickerOpen(false); }}
                            >
                                {m.slice(0, 3)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
