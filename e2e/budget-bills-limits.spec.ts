import { test, expect, type Page } from '@playwright/test';
import { signUp, thisMonth, settle, addExpense, dayInt } from './helpers';

const fixedRow = (page: Page, label: string) =>
    page.getByTestId('fixed-row').filter({ has: page.locator(`input[value="${label}"]`) });
const paidBox = (page: Page, label: string) => page.getByRole('checkbox', { name: `${label} paid` });

async function putPlan(page: Page, year: number, month: number, data: unknown) {
    const res = await page.request.put(`/api/budget/${year}/${month}`, { data });
    expect(res.ok()).toBeTruthy();
}

const today = new Date();
const D = today.getDate();

test.describe('bills on the Budget page', () => {
    test.beforeEach(async ({ page }) => {
        await signUp(page);
    });

    test('ticking a bill in a saved month saves straight away and updates the totals', async ({ page }) => {
        const { year, month } = thisMonth();
        await putPlan(page, year, month, {
            fixedExpenses: [
                { id: 'rent', label: 'Rent', category: 'Housing', amount: 2200, dueDay: 28 },
                { id: 'phone', label: 'Phone', category: 'Other', amount: 68 },
            ],
        });
        await page.goto('/monthly-budget');
        await settle(page);

        const foot = page.getByTestId('bills-foot');
        await expect(foot).toContainText('LEFT TO PAY 2,268.00');
        const saved = page.waitForResponse(r => r.url().includes('/bills/rent') && r.request().method() === 'PATCH');
        await paidBox(page, 'Rent').check();
        expect((await saved).ok()).toBeTruthy();
        await expect(foot).toContainText('LEFT TO PAY 68.00');
        await expect(foot).toContainText('PAID 2,200.00');
        await expect(page.getByText('· UNSAVED CHANGES')).toHaveCount(0); // nothing left to save

        await page.reload();
        await settle(page);
        await expect(paidBox(page, 'Rent')).toBeChecked();
        await expect(paidBox(page, 'Phone')).not.toBeChecked();
    });

    test('a due day can be set and is kept after saving', async ({ page }) => {
        const { year, month } = thisMonth();
        await putPlan(page, year, month, { fixedExpenses: [{ id: 'rent', label: 'Rent', category: 'Housing', amount: 2200 }] });
        await page.goto('/monthly-budget');
        await settle(page);

        const due = page.getByRole('textbox', { name: 'Rent due day' });
        await due.fill('45');
        await expect(due).toHaveValue(''); // not a day of the month: refused, not changed into 31
        await due.fill('31');
        await due.blur();
        await expect(due).toHaveValue('31');
        await page.getByRole('button', { name: 'SAVE MONTH' }).click();
        await expect(page.getByRole('button', { name: '✓ SAVED' })).toBeVisible();

        await page.reload();
        await settle(page);
        await expect(page.getByRole('textbox', { name: 'Rent due day' })).toHaveValue('31');
    });

    test('an unpaid bill past its due day is highlighted as overdue', async ({ page }) => {
        test.skip(D === 1, 'nothing can be overdue on the 1st');
        const { year, month } = thisMonth();
        await putPlan(page, year, month, { fixedExpenses: [{ id: 'tax', label: 'Taxes', category: 'Tax', amount: 400, dueDay: 1 }] });
        await page.goto('/monthly-budget');
        await settle(page);

        await expect(page.getByTestId('bills-foot')).toContainText('1 OVERDUE');
        await expect(fixedRow(page, 'Taxes')).toHaveClass(/overdueRow/);
        await paidBox(page, 'Taxes').check();
        await expect(page.getByTestId('bills-foot')).not.toContainText('OVERDUE');
        await expect(fixedRow(page, 'Taxes')).not.toHaveClass(/overdueRow/);
    });

    test('in a month that is only a copy, a tick is an unsaved change until SAVE MONTH', async ({ page }) => {
        const { year, month } = thisMonth();
        const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
        await putPlan(page, year, month, { fixedExpenses: [{ id: 'rent', label: 'Rent', category: 'Housing', amount: 2200, dueDay: 1, paid: true }] });

        await page.goto('/monthly-budget');
        await settle(page);
        await page.getByRole('button', { name: 'Next month' }).click();
        await settle(page);
        await expect(page.getByText(/COPIED FROM .* · NOT SAVED/).filter({ visible: true }).first()).toBeVisible();
        await expect(paidBox(page, 'Rent')).not.toBeChecked(); // a new month starts unpaid

        await paidBox(page, 'Rent').check();
        await page.getByRole('button', { name: 'SAVE MONTH' }).click();
        await expect(page.getByRole('button', { name: '✓ SAVED' })).toBeVisible();

        const saved = await (await page.request.get(`/api/budget/${next.year}/${next.month}`)).json();
        expect(saved).toMatchObject({ source: 'saved', fixedExpenses: [{ id: 'rent', paid: true, dueDay: 1 }] });
    });
});

test.describe('category limits on the Budget page', () => {
    test.beforeEach(async ({ page }) => {
        await signUp(page);
    });

    test('a limit shows what is left, the daily allowance and over-budget categories', async ({ page }) => {
        await addExpense(page, dayInt(), 'Food', 150, 'Groceries');
        await addExpense(page, dayInt(), 'Entertainment', 46.2, 'Cinema');
        await addExpense(page, dayInt(), 'Health', 24.6, 'Pharmacy');
        await page.goto('/monthly-budget');
        await settle(page);
        await expect(page.getByTestId('sum-left')).toContainText('NO LIMITS');

        await page.getByRole('textbox', { name: 'Food limit' }).fill('400');
        await page.getByRole('textbox', { name: 'Entertainment limit' }).fill('40');
        await page.getByRole('textbox', { name: 'Entertainment limit' }).blur();

        const rows = page.getByTestId('limit-row');
        await expect(rows.filter({ hasText: 'Food' })).toContainText('250.00 LEFT');
        await expect(rows.filter({ hasText: 'Entertainment' })).toContainText('OVER BY 6.20');
        await expect(rows.filter({ hasText: 'Health' })).toContainText('NO LIMIT');
        await expect(page.getByText('$250.00 left to spend')).toBeVisible(); // Food has 250 left; Entertainment being over is shown apart
        await expect(page.getByText(/OVER BY 6.20 IN ENTERTAINMENT/)).toBeVisible();
        await expect(page.getByText(/24\.60 UNBUDGETED/)).toBeVisible();
        await expect(page.getByTestId('sum-left')).toContainText('250.00');
        await expect(page.getByText('· UNSAVED CHANGES').or(page.getByText('· UNSAVED')).filter({ visible: true }).first()).toBeVisible();

        await page.getByRole('button', { name: 'SAVE MONTH' }).click();
        await expect(page.getByRole('button', { name: '✓ SAVED' })).toBeVisible();
        await page.reload();
        await settle(page);
        await expect(page.getByRole('textbox', { name: 'Food limit' })).toHaveValue('400.00');
    });

    test('"Suggest from my spending" fills empty limits from the last 3 months', async ({ page }) => {
        const d = new Date(today.getFullYear(), today.getMonth() - 1, 10);
        const lastMonth = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + 10;
        await addExpense(page, lastMonth, 'Food', 284, 'older');
        await addExpense(page, lastMonth, 'Transport', 41, 'older');
        await page.goto('/monthly-budget');
        await settle(page);

        await expect(page.getByRole('textbox', { name: 'Food limit' })).toHaveAttribute('placeholder', 'avg 290');
        await page.getByRole('textbox', { name: 'Transport limit' }).fill('100');
        await page.getByRole('button', { name: /SUGGEST FROM MY SPENDING/ }).click();
        await expect(page.getByRole('textbox', { name: 'Food limit' })).toHaveValue('290.00');
        await expect(page.getByRole('textbox', { name: 'Transport limit' })).toHaveValue('100.00'); // already set: kept
        await expect(page.getByText('FILLED 1 LIMIT FROM YOUR SPENDING')).toBeVisible();
    });
});
