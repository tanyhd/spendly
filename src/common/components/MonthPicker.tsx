'use client';

import { useState, useEffect, useRef } from 'react';
import cx from 'classnames';
import { MONTHS_SHORT, fmtMonth } from '@/lib/format';
import styles from './MonthPicker.module.css';

type Props = {
    year: number;
    month: number;
    onChange: (year: number, month: number) => void;
    className?: string;
};

export default function MonthPicker({ year, month, onChange, className }: Props) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerYear, setPickerYear] = useState(year);
    const ref = useRef<HTMLDivElement>(null);
    const now = new Date();

    useEffect(() => {
        if (!pickerOpen) return;
        setPickerYear(year);
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setPickerOpen(false);
            }
        }
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setPickerOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
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
        <div className={cx(styles.wrap, className)} ref={ref}>
            <button className={styles.navBtn} onClick={prevMonth} aria-label="Previous month">‹</button>
            <button className={cx(styles.label, pickerOpen && styles.labelOpen)} onClick={() => setPickerOpen(o => !o)}>
                {fmtMonth(year, month)} <span className={styles.caret} aria-hidden="true" />
            </button>
            <button className={styles.navBtn} onClick={nextMonth} aria-label="Next month">›</button>

            {pickerOpen && (
                <div className={styles.picker}>
                    <div className={styles.yearRow}>
                        <button className={styles.yearBtn} onClick={() => setPickerYear(y => y - 1)} aria-label="Previous year">‹</button>
                        <span className={styles.year}>{pickerYear}</span>
                        <button className={styles.yearBtn} onClick={() => setPickerYear(y => y + 1)} aria-label="Next year">›</button>
                    </div>
                    <div className={styles.grid}>
                        {MONTHS_SHORT.map((m, i) => {
                            const selected = pickerYear === year && i + 1 === month;
                            const current = pickerYear === now.getFullYear() && i === now.getMonth();
                            return (
                                <button
                                    key={m}
                                    className={cx(styles.month, selected && styles.monthActive, current && !selected && styles.monthCurrent)}
                                    onClick={() => { onChange(pickerYear, i + 1); setPickerOpen(false); }}
                                >
                                    {m.toUpperCase()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
