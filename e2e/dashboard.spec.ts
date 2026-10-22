import { test, expect } from '@playwright/test';
import { signUp, saveBudget, addExpense, thisMonth, dayInt, settle, isPhone } from './helpers';

test.describe('dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await signUp(page);
    });

    test('a new user sees the get-started strip', async ({ page }) => {
        await page.goto('/dashboard');
        await settle(page);
        await expect(page.getByText(/GET [A-Z]{3} \d{4} STARTED/)).toBeVisible();
        await expect(page.getByText('No transactions this month yet.')).toBeVisible();
    });

    test('adds up the month: net savings, income, fixed and daily spending', async ({ page }, info) => {
        const { year, month } = thisMonth();
        await saveBudget(page, year, month, 5000, [{ label: 'Rent', category: 'Housing', amount: 1500 }]);
        await addExpense(page, dayInt(0), 'Food', 30, 'Groceries');
        await addExpense(page, dayInt(0), 'Transport', 20, 'Taxi');

        await page.goto('/dashboard');
        await settle(page);
        await expect(page.getByText('+3,450.00')).toBeVisible();              // 5000 − 1500 − 50
        await expect(page.getByText('5,000.00')).toBeVisible();
        await expect(page.getByText('FIX 1,500.00 / DAY 50.00')).toBeVisible();
        // The "BUDGET SAVED" label sits in the desktop toolbar only
        if (!isPhone(info)) await expect(page.getByText('BUDGET SAVED')).toBeVisible();
        await expect(page.getByText('Groceries')).toBeVisible();
        await expect(page.getByText(/GET .* STARTED/)).toBeHidden();
    });

    test('says when a saved budget has no fixed expenses', async ({ page }) => {
        const { year, month } = thisMonth();
        await saveBudget(page, year, month, 1000, []);
        await addExpense(page, dayInt(0), 'Food', 10);
        await page.goto('/dashboard');
        await settle(page);
        await expect(page.getByText('No fixed expenses in this month’s budget.')).toBeVisible();
    });

    test('shows negative savings in red when spending beats income', async ({ page }) => {
        const { year, month } = thisMonth();
        await saveBudget(page, year, month, 100, []);
        await addExpense(page, dayInt(0), 'Shopping', 250);
        await page.goto('/dashboard');
        await settle(page);
        const net = page.getByText('−150.00');
        await expect(net).toBeVisible();
        const color = await net.evaluate(el => getComputedStyle(el).color);
        const neg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--neg').trim());
        expect(color).toBe(await page.evaluate(c => { const d = document.createElement('div'); d.style.color = c; document.body.append(d); const v = getComputedStyle(d).color; d.remove(); return v; }, neg));
    });

    test('switches month with the month picker', async ({ page }) => {
        await page.goto('/dashboard');
        await settle(page);
        await page.getByRole('button', { name: /^[A-Z]{3} \d{4}$/ }).click();
        await page.getByRole('button', { name: 'JAN', exact: true }).click();
        await expect(page.getByRole('button', { name: /^JAN \d{4}$/ })).toBeVisible();
    });
});
