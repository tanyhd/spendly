'use client';

import { useState, useEffect, useRef } from 'react';
import cx from 'classnames';
import { MONTHS, getWeekStart, fmtWeekRange } from '@/lib/format';
import styles from './WeekPicker.module.css';

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

type Props = {
    weekStart: Date;
    onChange: (weekStart: Date) => void;
    /** Adds a TODAY cell that jumps to the current week */
    showToday?: boolean;
    className?: string;
};

export default function WeekPicker({ weekStart, onChange, showToday = false, className }: Props) {
    const [open, setOpen] = useState(false);
    const [calYear, setCalYear] = useState(weekStart.getFullYear());
    const [calMonth, setCalMonth] = useState(weekStart.getMonth());
    const ref = useRef<HTMLDivElement>(null);
    const today = new Date();
    const thisWeek = getWeekStart(today);

    useEffect(() => {
        if (!open) return;
        setCalYear(weekStart.getFullYear());
        setCalMonth(weekStart.getMonth());
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open, weekStart]);

    function prevCal() {
        if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
        else setCalMonth(m => m - 1);
    }
    function nextCal() {
        if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
        else setCalMonth(m => m + 1);
    }

    // One row per Monday-start week that touches the shown month
    const rows: Date[][] = [];
    const lastOfMonth = new Date(calYear, calMonth + 1, 0);
    for (let w = getWeekStart(new Date(calYear, calMonth, 1)); w <= lastOfMonth; w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)) {
        rows.push(Array.from({ length: 7 }, (_, i) => new Date(w.getFullYear(), w.getMonth(), w.getDate() + i)));
    }

    function shiftWeek(delta: number) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + delta * 7);
        onChange(getWeekStart(d));
    }

    return (
        <div className={cx(styles.wrap, className)} ref={ref}>
            <button className={styles.navBtn} onClick={() => shiftWeek(-1)} aria-label="Previous week">‹</button>
            <button className={cx(styles.label, open && styles.labelOpen)} onClick={() => setOpen(o => !o)}>
                {fmtWeekRange(weekStart)} <span className={styles.caret} aria-hidden="true" />
            </button>
            <button className={styles.navBtn} onClick={() => shiftWeek(1)} aria-label="Next week">›</button>
            {showToday && (
                <button
                    className={cx(styles.today, sameDay(weekStart, thisWeek) && styles.todayCurrent)}
                    onClick={() => onChange(thisWeek)}
                >
                    TODAY
                </button>
            )}

            {open && (
                <div className={styles.picker}>
                    <div className={styles.calHeader}>
                        <button className={styles.calBtn} onClick={prevCal} aria-label="Previous month">‹</button>
                        <span className={styles.calMonth}>{MONTHS[calMonth].toUpperCase()} {calYear}</span>
                        <button className={styles.calBtn} onClick={nextCal} aria-label="Next month">›</button>
                    </div>
                    <div className={styles.dayHeaders}>
                        {DAY_HEADERS.map((d, i) => <span key={i}>{d}</span>)}
                    </div>
                    <div className={styles.weeks}>
                        {rows.map(row => (
                            <button
                                key={row[0].toISOString()}
                                className={cx(styles.week, sameDay(row[0], weekStart) && styles.weekSelected)}
                                onClick={() => { onChange(row[0]); setOpen(false); }}
                            >
                                {row.map(d => (
                                    <span
                                        key={d.getDate()}
                                        className={cx(
                                            styles.day,
                                            d.getMonth() !== calMonth && styles.dayOther,
                                            sameDay(d, today) && styles.dayToday,
                                        )}
                                    >
                                        {d.getDate()}
                                    </span>
                                ))}
                            </button>
                        ))}
                    </div>
                    <div className={styles.hint}>PICK A ROW TO JUMP TO THAT WEEK</div>
                </div>
            )}
        </div>
    );
}
