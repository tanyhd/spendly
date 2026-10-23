import { test, expect, type Page } from '@playwright/test';
import { signUp, settle, addExpense, dayInt, isPhone } from './helpers';

const rows = (page: Page) => page.getByTestId('expense-row');
const total = (page: Page) => page.getByTestId('filter-total');
const search = (page: Page) => page.getByRole('textbox', { name: 'Search notes or categories' });

test.describe('all expenses', () => {
    test.beforeEach(async ({ page }) => {
        await signUp(page);
    });

    test('opens from the Week tab and lists every expense newest first, with day totals', async ({ page }, info) => {
        await addExpense(page, dayInt(), 'Food', 12.5, 'Lunch');
        await addExpense(page, dayInt(), 'Transport', 3.2, 'MRT');
        await addExpense(page, dayInt(-40), 'Shopping', 80, 'Shoes');

        await page.goto('/daily-log');
        await page.getByRole('link', { name: 'ALL EXPENSES' }).click();
        await expect(page).toHaveURL(/\/daily-log\/all$/);
        await settle(page);
        if (isPhone(info)) await expect(page.getByText('ALL EXPENSES', { exact: true }).first()).toBeVisible();

        await expect(total(page)).toContainText('$95.70');
        await expect(total(page)).toContainText('3 EXPENSES · ALL TIME');
        await expect(rows(page)).toHaveCount(3);
        await expect(rows(page).first()).toContainText('Transport'); // newest added first on the same day
        await expect(rows(page).last()).toContainText('Shoes');
        await expect(page.getByRole('region', { name: /TODAY|\d{4}$/ }).first()).toContainText('15.70');
    });

    test('search, date presets and category chips combine', async ({ page }) => {
        await addExpense(page, dayInt(), 'Food', 12.5, 'Lunch with Sam');
        await addExpense(page, dayInt(), 'Food', 40, 'Groceries');
        await addExpense(page, dayInt(), 'Transport', 3.2, 'Bus');
        await addExpense(page, dayInt(-400), 'Food', 9, 'lunch');
        await page.goto('/daily-log/all');
        await settle(page);

        await search(page).fill('lunch');
        await expect(total(page)).toContainText('2 EXPENSES');
        await expect(total(page)).toContainText('"lunch"');

        await page.getByRole('button', { name: 'THIS YEAR' }).click();
        await expect(total(page)).toContainText('1 EXPENSE ·');
        await expect(total(page)).toContainText('$12.50');

        await search(page).fill('');
        await page.getByRole('button', { name: 'Transport', exact: true }).click();
        await expect(total(page)).toContainText('$3.20');
        await page.getByRole('button', { name: 'Food', exact: true }).click(); // multi-select
        await expect(total(page)).toContainText('$55.70');

        await page.getByRole('button', { name: 'CLEAR FILTERS' }).click();
        await expect(total(page)).toContainText('4 EXPENSES · ALL TIME');
    });

    test('"/" jumps to search, and a search with no results says so', async ({ page }) => {
        await addExpense(page, dayInt(), 'Food', 12.5, 'Lunch');
        await page.goto('/daily-log/all');
        await settle(page);
        await page.keyboard.press('/');
        await expect(search(page)).toBeFocused();
        await page.keyboard.type('sushi');
        await expect(page.getByText('No expenses match "sushi".')).toBeVisible();
        await page.getByRole('button', { name: 'CLEAR FILTERS' }).last().click();
        await expect(rows(page)).toHaveCount(1);
    });

    test('loads more in pages of 40, with no repeats', async ({ page }) => {
        for (let i = 0; i < 45; i++) await addExpense(page, dayInt(-i), 'Food', 1, `meal ${i}`);
        await page.goto('/daily-log/all');
        await settle(page);
        await expect(rows(page)).toHaveCount(40);
        await page.getByRole('button', { name: 'LOAD 5 MORE · 5 LEFT' }).click();
        await expect(rows(page)).toHaveCount(45);
        await expect(page.getByText(/ALL 45 SHOWN · THAT'S EVERYTHING/)).toBeVisible();
        const notes = await rows(page).allInnerTexts();
        expect(new Set(notes).size).toBe(45);
    });

    test('a row opens the edit form, and delete can be undone', async ({ page }) => {
        await addExpense(page, dayInt(), 'Food', 12.5, 'Lunch');
        await page.goto('/daily-log/all');
        await settle(page);

        await page.getByRole('button', { name: /^Edit Food 12\.50 Lunch$/ }).click();
        await expect(page.getByText('EDIT EXPENSE')).toBeVisible();
        await page.getByPlaceholder('e.g. Lunch').fill('Dinner');
        await page.getByRole('button', { name: /SAVE/ }).click();
        await expect(rows(page).first()).toContainText('Dinner');

        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(rows(page)).toHaveCount(0);
        await expect(page.getByText('Nothing logged yet.')).toBeVisible();
        await page.getByRole('button', { name: 'UNDO' }).click();
        await expect(rows(page)).toHaveCount(1);
    });

    test('exports exactly what is shown as CSV', async ({ page }) => {
        await addExpense(page, dayInt(), 'Food', 12.5, 'Lunch, "big" one');
        await addExpense(page, dayInt(), 'Transport', 3.2, 'Bus');
        await page.goto('/daily-log/all');
        await settle(page);
        await page.getByRole('button', { name: 'Food', exact: true }).click();
        await expect(total(page)).toContainText('1 EXPENSE ·');

        const download = page.waitForEvent('download');
        await page.getByRole('link', { name: /CSV/ }).click();
        const file = await (await download).path();
        const raw = (await import('fs')).readFileSync(file, 'utf8');
        expect(raw.startsWith('﻿')).toBe(true); // byte order mark, so Excel reads it as UTF-8
        expect(raw.slice(1).split('\r\n').filter(Boolean)).toEqual([
            '"Date","Category","Note","Amount"',
            expect.stringMatching(/^"\d{4}-\d{2}-\d{2}","Food","Lunch, ""big"" one",12\.50$/),
        ]);
    });

    test('with nothing logged it offers to add the first expense', async ({ page }) => {
        await page.goto('/daily-log/all');
        await settle(page);
        await expect(page.getByText('Nothing logged yet.')).toBeVisible();
        await expect(page.getByRole('link', { name: /CSV/ })).toHaveAttribute('aria-disabled', 'true');
        await page.getByRole('button', { name: '+ ADD YOUR FIRST EXPENSE' }).click();
        await expect(page.getByText('NEW EXPENSE')).toBeVisible();
    });
});
