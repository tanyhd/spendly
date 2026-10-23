import Link from 'next/link';
import cx from 'classnames';
import type { BillTotals, UpcomingBill, UpcomingResult } from '@/lib/bills';
import { fixedCategory } from '@/common/constants/categories';
import CategoryTag from '@/common/components/CategoryTag';
import { DOW, MONTHS_SHORT, addDaysInt, fmt, fmtDayShort, fromDateInt, plural } from '@/lib/format';
import styles from './Dashboard.module.css';

type Props = {
    upcoming: UpcomingResult;
    /** This month's bill totals for the footer */
    month: BillTotals | null;
    today: number;
    onTick: (bill: UpcomingBill) => void;
};

function when(b: UpcomingBill, today: number) {
    if (b.status === 'overdue') return { text: `${b.daysOverdue}D OVERDUE`, color: 'var(--neg)' };
    if (b.status === 'today') return { text: 'TODAY', color: 'var(--primary)' };
    const days = Math.round((fromDateInt(b.dueDate).getTime() - fromDateInt(today).getTime()) / 86_400_000);
    return { text: days === 1 ? 'TOMORROW' : `IN ${days} DAYS`, color: 'var(--muted)' };
}

/** Bills due in the next 7 days (with a paid tick each), then the ones coming later */
export default function ComingUp({ upcoming, month, today, onTick }: Props) {
    const days = Array.from({ length: 7 }, (_, i) => addDaysInt(today, i));
    const unpaid = upcoming.items.filter(i => !i.paid);
    const overdue = unpaid.filter(i => i.status === 'overdue').length;
    const dueDays = new Set(unpaid.map(i => i.dueDate));
    const monthName = MONTHS_SHORT[Math.floor(today / 100) % 100 - 1].toUpperCase();
    const hasBills = upcoming.items.length + upcoming.later.length > 0 || (month?.total ?? 0) > 0;

    let sentence: string;
    if (unpaid.length > 0) {
        sentence = `You have ${plural(unpaid.length, 'bill', 'bills')} due${overdue ? `, ${overdue} overdue,` : ''} in the next 7 days for $${fmt(upcoming.unpaid.amount)}.`;
    } else if (month && month.total > 0 && month.leftToPay === 0) {
        sentence = `Every bill for ${monthName} is paid. Nice.`;
    } else if (hasBills) {
        sentence = 'Nothing due in the next 7 days.';
    } else {
        sentence = 'Give your fixed expenses a due day on the Budget page to see them coming up here.';
    }

    return (
        <div className={styles.comingUp} data-testid="coming-up">
            <div className={styles.comingHead}>
                <div className={styles.panelHead}>
                    <span>COMING UP · NEXT 7 DAYS</span>
                    {unpaid.length > 0
                        ? <span style={{ color: 'var(--neg)' }}>{unpaid.length} DUE · {fmt(upcoming.unpaid.amount)}</span>
                        : hasBills && <span style={{ color: 'var(--pos)' }}>ALL CLEAR</span>}
                </div>
                <p className={styles.comingText}>{sentence}</p>
                {!hasBills && <Link href="/monthly-budget" className={styles.panelLink}>ADD DUE DAYS →</Link>}
                {hasBills && (
                    <div className={styles.strip}>
                        {days.map(d => (
                            <div key={d} className={cx(styles.stripDay, dueDays.has(d) && styles.stripDue, d === today && styles.stripToday)}>
                                <span className={styles.stripDow}>{DOW[(fromDateInt(d).getDay() + 6) % 7]}</span>
                                <span className={styles.stripNum}>{d % 100}</span>
                                {dueDays.has(d) && <span className={styles.stripDot} />}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {upcoming.items.map(b => {
                const w = when(b, today);
                return (
                    <div key={`${b.year}-${b.month}-${b.rowId}`} className={cx(styles.billRow, b.status === 'overdue' && styles.billOverdue, b.paid && styles.billPaid)} data-testid="bill-row">
                        <span className={styles.billTick}>
                            <input
                                type="checkbox"
                                className={cx(styles.paidBox, b.status === 'overdue' && styles.paidBoxAlert)}
                                checked={b.paid}
                                onChange={() => onTick(b)}
                                aria-label={`${b.label} paid`}
                            />
                        </span>
                        <span className={styles.billMain}><CategoryTag category={fixedCategory(b.category)} />{b.label}</span>
                        <span className={styles.billWhen} style={{ color: b.paid ? 'var(--pos)' : w.color }}>{b.paid ? 'PAID' : w.text}</span>
                        <span className={cx(styles.billAmt, 'num')}>{fmt(b.amount)}</span>
                    </div>
                );
            })}

            {upcoming.later.length > 0 && (
                <div className={styles.later}>
                    <span className={styles.laterHead}>COMING LATER</span>
                    {upcoming.later.map(b => (
                        <div key={`${b.year}-${b.month}-${b.rowId}`} className={styles.laterRow}>
                            <span className={styles.laterDate}>{fmtDayShort(b.dueDate)}</span>
                            <span className={styles.laterName}>{b.label}</span>
                            <span className="num">{fmt(b.amount)}</span>
                        </div>
                    ))}
                </div>
            )}

            {month && month.total > 0 && (
                <div className={styles.billsFoot} data-testid="bills-foot">
                    <span>{monthName} · LEFT TO PAY <b className="num">{fmt(month.leftToPay)}</b></span>
                    <span>PAID <b className="num" style={{ color: 'var(--pos)' }}>{fmt(month.paid)}</b></span>
                    {month.overdueCount > 0 && <span style={{ color: 'var(--neg)' }}>{month.overdueCount} OVERDUE</span>}
                </div>
            )}
        </div>
    );
}
