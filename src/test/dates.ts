// Today's date parts in local time, for tests that depend on "this month"
export function thisMonthParts() {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}
