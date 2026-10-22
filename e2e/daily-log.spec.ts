import { test, expect } from '@playwright/test';
import { signUp, addExpense, dayInt, settle } from './helpers';

// The week shown by default is the current Monday–Sunday week
function mondayOffset() {
    const day = new Date().getDay(); // 0 = Sunday
    return day === 0 ? -6 : 1 - day;
}

test.describe('daily log', () => {
    test.beforeEach(async ({ page }) => {
        await signUp(page);
    });

    test('shows this week, collapses empty days and totals the week', async ({ page }) => {
        const monday = dayInt(mondayOffset());
        await addExpense(page, monday, 'Food', 12.5, 'Lunch');
        await addExpense(page, monday, 'Transport', 3.2, 'MRT');
        await page.goto('/daily-log');
        await settle(page);

        await expect(page.getByText('Lunch')).toBeVisible();
        await expect(page.getByText('MRT')).toBeVisible();
        await expect(page.getByText('15.70').first()).toBeVisible();   // week total and Monday subtotal
        await expect(page.getByText('No expenses').first()).toBeVisible();
        await expect(page.getByText('TODAY', { exact: true }).first()).toBeVisible();
    });

    test('adds an expense to a chosen day from its + ADD button', async ({ page }) => {
        await page.goto('/daily-log');
        await settle(page);
        await page.getByRole('button', { name: '+ ADD', exact: true }).first().click(); // Monday
        await page.getByPlaceholder('0.00').fill('9.90');
        await page.getByPlaceholder('e.g. Lunch').fill('Breakfast');
        await page.getByRole('button', { name: /ADD ENTRY/ }).click();
        await expect(page.getByText('Breakfast')).toBeVisible();

        const monday = dayInt(mondayOffset());
        const list = await (await page.request.get(`/api/daily-log?weekStart=${monday}`)).json();
        expect(list).toEqual([expect.objectContaining({ date: monday, amount: 9.9, note: 'Breakfast' })]);
    });

    test('edits an expense; the date cannot be changed', async ({ page }) => {
        await addExpense(page, dayInt(0), 'Food', 12.5, 'Lunch');
        await page.goto('/daily-log');
        await settle(page);

        await page.getByRole('button', { name: 'Edit' }).first().click();
        await expect(page.getByText("DATE CAN'T BE CHANGED")).toBeVisible();
        await page.getByPlaceholder('0.00').fill('14');
        await page.getByPlaceholder('e.g. Lunch').fill('Late lunch');
        await page.getByRole('button', { name: /SAVE CHANGES/ }).click();

        await expect(page.getByText('Late lunch')).toBeVisible();
        await expect(page.getByText('−14.00')).toBeVisible();
    });

    test('deletes an expense and brings it back with UNDO', async ({ page }) => {
        await addExpense(page, dayInt(0), 'Food', 12.5, 'Lunch');
        await page.goto('/daily-log');
        await settle(page);

        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(page.getByRole('status')).toHaveText(/DELETED FOOD \$12\.50/);
        await expect(page.getByText('Lunch')).toBeHidden();

        await page.getByRole('button', { name: 'UNDO' }).click();
        await expect(page.getByText('Lunch')).toBeVisible();
    });

    test('moves between weeks and back to today', async ({ page }) => {
        await addExpense(page, dayInt(-7), 'Shopping', 40, 'Last week');
        await page.goto('/daily-log');
        await settle(page);
        await expect(page.getByText('Last week')).toBeHidden();

        await page.getByRole('button', { name: 'Previous week' }).click();
        await expect(page.getByText('Last week')).toBeVisible();

        await page.getByRole('button', { name: 'TODAY', exact: true }).click();
        await expect(page.getByText('Last week')).toBeHidden();
    });
});
