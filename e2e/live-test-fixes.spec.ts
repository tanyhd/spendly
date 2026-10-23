// Fixes for what the live-site test found (docs/ui-revamp/tier1/live-test)
import { test, expect, type Page } from '@playwright/test';
import { signUp, settle, addExpense, dayInt, thisMonth, isPhone } from './helpers';

async function putPlan(page: Page, year: number, month: number, data: unknown) {
    const res = await page.request.put(`/api/budget/${year}/${month}`, { data });
    expect(res.ok()).toBeTruthy();
}

test.describe('fixes from the live test', () => {
    test.beforeEach(async ({ page }) => {
        await signUp(page);
    });

    test('a custom range the wrong way round says so instead of showing old results', async ({ page }) => {
        await addExpense(page, 20260915, 'Food', 12.5, 'Lunch');
        await page.goto('/daily-log/all');
        await settle(page);
        await page.getByRole('button', { name: 'CUSTOM' }).click();
        await page.locator('input[type="date"]').first().fill('2026-10-20');
        await page.locator('input[type="date"]').last().fill('2026-10-01');

        await expect(page.getByRole('alert').filter({ hasText: 'The From date is after the To date.' })).toBeVisible();
        await expect(page.getByTestId('expense-row')).toHaveCount(0);
        await expect(page.getByRole('link', { name: /CSV/ })).toHaveAttribute('aria-disabled', 'true');

        await page.locator('input[type="date"]').first().fill('2026-09-01');
        await expect(page.getByTestId('expense-row')).toHaveCount(1);
    });

    test('"VIEW ALL" on the dashboard opens all expenses for the period on screen', async ({ page }, info) => {
        test.skip(isPhone(info), 'same link on phone; the month picker is covered on desktop');
        await addExpense(page, dayInt(), 'Food', 5, 'Today');
        const prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1);
        const lastMonthDay = prev.getFullYear() * 10000 + (prev.getMonth() + 1) * 100 + 10;
        await addExpense(page, lastMonthDay, 'Food', 7, 'Last month');

        await page.goto('/dashboard');
        await settle(page);
        await page.getByRole('button', { name: 'Previous month' }).click();
        await settle(page);
        await page.getByRole('link', { name: /VIEW ALL/ }).click();
        await expect(page).toHaveURL(/\/daily-log\/all\?from=\d{8}&to=\d{8}$/);
        await settle(page);
        await expect(page.getByRole('button', { name: 'CUSTOM' })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('expense-row')).toHaveCount(1);
        await expect(page.getByTestId('expense-row')).toContainText('Last month');
    });

    test('the due-day box only takes days 1–31 and says so otherwise', async ({ page }) => {
        const { year, month } = thisMonth();
        await putPlan(page, year, month, { fixedExpenses: [{ id: 'rent', label: 'Rent', category: 'Housing', amount: 100 }] });
        await page.goto('/monthly-budget');
        await settle(page);
        const due = page.getByRole('textbox', { name: 'Rent due day' });

        await due.pressSequentially('5.5');
        await expect(due).toHaveValue('5');               // "." and the 55 that would follow are refused
        await expect(page.getByText('DUE DAY IS A DAY OF THE MONTH, 1–31').first()).toBeVisible();

        await due.fill('');
        await due.pressSequentially('32');
        await expect(due).toHaveValue('3');

        await due.fill('0');
        await due.blur();
        await expect(due).toHaveValue('');
    });

    test('keyboard shortcuts still work after ticking a bill', async ({ page }, info) => {
        test.skip(isPhone(info), 'no keyboard shortcuts on phone');
        const { year, month } = thisMonth();
        await putPlan(page, year, month, { fixedExpenses: [{ id: 'rent', label: 'Rent', category: 'Housing', amount: 100, dueDay: 28 }] });
        await page.goto('/monthly-budget');
        await settle(page);
        const saved = page.waitForResponse(r => r.url().includes('/bills/rent'));
        await page.getByRole('checkbox', { name: 'Rent paid' }).check();
        await saved;
        await page.keyboard.press('1');
        await expect(page).toHaveURL(/\/dashboard$/);
    });

    test('a row with an amount needs a label; an empty new row is just dropped', async ({ page }) => {
        const { year, month } = thisMonth();
        await putPlan(page, year, month, { income: [{ id: 'sal', label: 'Salary', category: 'Employment', amount: 5000 }] });
        await page.goto('/monthly-budget');
        await settle(page);

        await page.getByRole('button', { name: '+ ADD INCOME ROW' }).click();
        await expect(page.getByRole('textbox', { name: 'Income label' }).last()).toBeFocused(); // the new row takes focus
        await page.getByRole('textbox', { name: 'Row amount' }).last().fill('200');
        await page.getByRole('button', { name: 'SAVE MONTH' }).click();
        await expect(page.getByText('GIVE EVERY ROW WITH AN AMOUNT A LABEL')).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Income label' }).last()).toBeFocused();

        await page.getByRole('textbox', { name: 'Row amount' }).last().fill('0');
        await page.getByRole('button', { name: 'SAVE MONTH' }).click();
        await expect(page.getByRole('button', { name: '✓ SAVED' })).toBeVisible();
        const saved = await (await page.request.get(`/api/budget/${year}/${month}`)).json();
        expect(saved.income.map((r: { label: string }) => r.label)).toEqual(['Salary']);
    });

    test('a budget two months ahead copies the latest saved month', async ({ page }) => {
        const { year, month } = thisMonth();
        await putPlan(page, year, month, { income: [{ id: 'sal', label: 'Salary', category: 'Employment', amount: 4321 }] });
        await page.goto('/monthly-budget');
        await settle(page);
        await page.getByRole('button', { name: 'Next month' }).click();
        await settle(page);
        await page.getByRole('button', { name: 'Next month' }).click();
        await settle(page);
        await expect(page.getByText(/COPIED FROM [A-Z]{3} \d{4} · NOT SAVED/).filter({ visible: true }).first()).toBeVisible();
        await expect(page.locator('input[inputmode="decimal"]').first()).toHaveValue('4321.00');
    });

    test('money boxes keep at most 2 decimals', async ({ page }) => {
        await page.goto('/daily-log');
        await settle(page);
        await page.keyboard.press('n');
        const amount = page.getByRole('dialog', { name: 'New expense' }).locator('input[inputmode="decimal"]');
        await amount.pressSequentially('12.345');
        await expect(amount).toHaveValue('12.34');
    });
});
