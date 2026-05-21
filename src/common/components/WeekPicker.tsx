'use client';

import { useState, useEffect, useRef } from 'react';
import cx from 'classnames';
import styles from './WeekPicker.module.css';

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}

function sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function fmtRange(ws: Date): string {
    const end = new Date(ws);
    end.setDate(end.getDate() + 6);
    const sm = ws.toLocaleDateString('en-US', { month: 'short' });
    const em = end.toLocaleDateString('en-US', { month: 'short' });
    const sy = ws.getFullYear();
    if (sm === em) return `${sm} ${ws.getDate()}–${end.getDate()} ${sy}`;
    return `${sm} ${ws.getDate()} – ${em} ${end.getDate()} ${sy}`;
}

type Props = {
    weekStart: Date;
    onChange: (weekStart: Date) => void;
};

export default function WeekPicker({ weekStart, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const [calYear, setCalYear] = useState(weekStart.getFullYear());
    const [calMonth, setCalMonth] = useState(weekStart.getMonth());
    const ref = useRef<HTMLDivElement>(null);
    const today = new Date();

    useEffect(() => {
        if (!open) return;
        setCalYear(weekStart.getFullYear());
        setCalMonth(weekStart.getMonth());
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open, weekStart]);

    function prevCal() {
        if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
        else setCalMonth(m => m - 1);
    }
    function nextCal() {
        if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
        else setCalMonth(m => m + 1);
    }

    // Build grid: previous month overflow + current month + next month overflow
    const firstOfMonth = new Date(calYear, calMonth, 1);
    const offset = (firstOfMonth.getDay() + 6) % 7; // 0=Mon … 6=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

    const allDays: Date[] = [
        ...Array.from({ length: offset }, (_, i) =>
            new Date(calYear, calMonth - 1, prevMonthDays - offset + i + 1)),
        ...Array.from({ length: daysInMonth }, (_, i) =>
            new Date(calYear, calMonth, i + 1)),
        ...Array.from({ length: totalCells - offset - daysInMonth }, (_, i) =>
            new Date(calYear, calMonth + 1, i + 1)),
    ];

    const rows: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) rows.push(allDays.slice(i, i + 7));

    function selectRow(row: Date[]) {
        onChange(getWeekStart(row[0]));
        setOpen(false);
    }

    function isSelectedRow(row: Date[]): boolean {
        return sameDay(getWeekStart(row[0]), weekStart);
    }

    function shiftWeek(delta: number) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + delta * 7);
        onChange(getWeekStart(d));
    }

    return (
        <div className={styles.wrap} ref={ref}>
            <div className={styles.nav}>
                <button className={styles.navBtn} onClick={() => shiftWeek(-1)}>&#8249;</button>
                <button className={styles.label} onClick={() => setOpen(o => !o)}>
                    {fmtRange(weekStart)}
                </button>
                <button className={styles.navBtn} onClick={() => shiftWeek(1)}>&#8250;</button>
            </div>

            {open && (
                <div className={styles.picker}>
                    <div className={styles.calHeader}>
                        <button className={styles.calBtn} onClick={prevCal}>&#8249;</button>
                        <span className={styles.calMonth}>{MONTHS[calMonth]} {calYear}</span>
                        <button className={styles.calBtn} onClick={nextCal}>&#8250;</button>
                        <button
                            className={styles.todayBtn}
                            onClick={() => { onChange(getWeekStart(today)); setOpen(false); }}
                        >
                            Today
                        </button>
                    </div>

                    <div className={styles.dayHeaders}>
                        {DAY_HEADERS.map((d, i) => (
                            <span key={i} className={styles.dayHeader}>{d}</span>
                        ))}
                    </div>

                    <div className={styles.grid}>
                        {rows.map((row, ri) => (
                            <button
                                key={ri}
                                className={cx(styles.week, isSelectedRow(row) && styles.weekSelected)}
                                onClick={() => selectRow(row)}
                            >
                                {row.map((d, di) => (
                                    <span
                                        key={di}
                                        className={cx(
                                            styles.day,
                                            d.getMonth() !== calMonth && styles.dayAdjacentMonth,
                                            sameDay(d, today) && styles.dayToday,
                                        )}
                                    >
                                        {d.getDate()}
                                    </span>
                                ))}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
