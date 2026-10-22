import fs from 'fs';
import { test, expect } from '@playwright/test';
import { signUp, saveBudget, addExpense, thisMonth, dayInt, settle, isPhone } from './helpers';

test.describe('annual overview', () => {
    test('an empty year says so and disables export', async ({ page }) => {
        await signUp(page);
        await page.goto('/annual-overview');
        await settle(page);
        await expect(page.getByText(/No data found for \d{4}\./)).toBeVisible();
        await expect(page.getByRole('button', { name: /EXPORT CSV/ })).toBeDisabled();
    });

    test('shows the year totals and exports them as CSV', async ({ page }, info) => {
        await signUp(page);
        const { year, month } = thisMonth();
        await saveBudget(page, year, month, 5000, [{ label: 'Rent', category: 'Housing', amount: 1500 }]);
        await addExpense(page, dayInt(0), 'Food', 40);

        await page.goto('/annual-overview');
        await settle(page);
        await expect(page.getByText('+3,460.00').first()).toBeVisible();

        if (isPhone(info)) {
            await page.getByRole('button', { name: 'FULL TABLE' }).click();
        }
        await expect(page.getByText('Rent').first()).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: /EXPORT CSV/ }).click(),
        ]);
        expect(download.suggestedFilename()).toBe(`spendly-${year}.csv`);
        const csv = fs.readFileSync(await download.path(), 'utf8');
        expect(csv).toContain(`"Annual Overview ${year}"`);
        expect(csv).toContain('"Rent"');
        expect(csv).toContain('"Food (daily log)"');
        expect(csv).toMatch(/"Total Income",.*"5000\.00"/);
    });

    test('collapses and expands a table section', async ({ page }, info) => {
        test.skip(isPhone(info), 'phone opens on the month list');
        await signUp(page);
        const { year, month } = thisMonth();
        await saveBudget(page, year, month, 5000);
        await page.goto('/annual-overview');
        await settle(page);

        await expect(page.getByText('Salary', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'INCOME', exact: true }).click();
        await expect(page.getByText('Salary', { exact: true })).toBeHidden();
        await page.getByRole('button', { name: 'INCOME', exact: true }).click();
        await expect(page.getByText('Salary', { exact: true })).toBeVisible();
    });
});
