// Shared steps for the end-to-end tests.
import { expect, type Page, type TestInfo } from '@playwright/test';

export const PASSWORD = 'E2ePass123!';

let n = 0;

/** Signs up a fresh user through the API; the page's browser context shares the session cookie */
export async function signUp(page: Page, name = 'Alex Tan') {
    const email = `e2e.${Date.now()}.${process.pid}.${++n}@example.test`;
    const res = await page.request.post('/api/auth/register', { data: { name, email, password: PASSWORD } });
    expect(res.ok()).toBeTruthy();
    return { name, email };
}

export const isPhone = (info: TestInfo) => info.project.name === 'phone';

/** Today and offsets as YYYYMMDD ints, in local time like the app */
export function dayInt(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function thisMonth() {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export async function addExpense(page: Page, date: number, category: string, amount: number, note = '') {
    const res = await page.request.post('/api/daily-log', { data: { date, category, amount, note } });
    expect(res.ok()).toBeTruthy();
    return res.json();
}

export async function saveBudget(page: Page, year: number, month: number, income: number, fixed: { label: string; category: string; amount: number }[] = []) {
    const res = await page.request.put(`/api/budget/${year}/${month}`, {
        data: { income: [{ label: 'Salary', category: 'Employment', amount: income }], fixedExpenses: fixed },
    });
    expect(res.ok()).toBeTruthy();
}

/** Waits until the page has loaded (client components fetch on mount) */
export async function settle(page: Page) {
    await page.waitForLoadState('networkidle');
}

/** Opens a page from the nav: the top bar on desktop, the tab bar on phone */
export async function openFromNav(page: Page, info: TestInfo, desktopLabel: RegExp, phoneLabel: string) {
    if (isPhone(info)) await page.getByRole('link', { name: phoneLabel, exact: true }).click();
    else await page.getByRole('link', { name: desktopLabel }).click();
}
