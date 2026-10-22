import { test, expect } from '@playwright/test';
import { signUp, isPhone, settle } from './helpers';

test.describe('app shell', () => {
    test.beforeEach(async ({ page }) => {
        await signUp(page);
        await page.goto('/dashboard');
        await settle(page);
    });

    test('navigates between every page', async ({ page }, info) => {
        const pages = isPhone(info)
            ? [['LOG', '/daily-log'], ['BUDGET', '/monthly-budget'], ['YEAR', '/annual-overview'], ['DASH', '/dashboard']]
            : [['DAILY LOG', '/daily-log'], ['BUDGET', '/monthly-budget'], ['ANNUAL', '/annual-overview'], ['SETTINGS', '/settings'], ['DASHBOARD', '/dashboard']];
        for (const [label, path] of pages) {
            await page.getByRole('link', { name: new RegExp(`${label}$`) }).filter({ visible: true }).first().click();
            await expect(page).toHaveURL(new RegExp(`${path}$`));
        }
    });

    test('keys 1–5 switch pages on desktop', async ({ page }, info) => {
        test.skip(isPhone(info), 'keyboard shortcuts are a desktop feature');
        for (const [key, path] of [['2', '/daily-log'], ['3', '/monthly-budget'], ['4', '/annual-overview'], ['5', '/settings'], ['1', '/dashboard']]) {
            await page.keyboard.press(key);
            await expect(page).toHaveURL(new RegExp(`${path}$`));
        }
    });

    test('adds an expense from anywhere and the dashboard updates', async ({ page }, info) => {
        if (isPhone(info)) await page.getByRole('button', { name: 'Add expense', exact: true }).click();
        else await page.keyboard.press('n');
        await expect(page.getByRole('form', { name: 'New expense' })).toBeVisible();

        // Amount is required
        await page.getByRole('button', { name: /ADD ENTRY/ }).click();
        await expect(page.getByText('Amount must be greater than 0')).toBeVisible();

        await page.getByPlaceholder('0.00').fill('18.40');
        await page.getByRole('button', { name: /TRN/ }).click();
        await page.getByPlaceholder('e.g. Lunch').fill('Taxi home');
        await page.getByRole('button', { name: /ADD ENTRY/ }).click();

        await expect(page.getByRole('status')).toHaveText(/ADDED TRANSPORT \$18\.40/);
        await expect(page.getByText('Taxi home')).toBeVisible();
        await expect(page.getByText('−18.40').first()).toBeVisible();
    });

    test('Escape closes the add panel without saving', async ({ page }, info) => {
        test.skip(isPhone(info), 'Escape is a keyboard action');
        await page.keyboard.press('n');
        await page.getByPlaceholder('0.00').fill('5');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('form', { name: 'New expense' })).toBeHidden();
        expect((await (await page.request.get(`/api/dashboard/${new Date().getFullYear()}/${new Date().getMonth() + 1}`)).json()).totalVariable).toBe(0);
    });

    test('switches to light mode from the account menu and keeps it after a reload', async ({ page }) => {
        const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
        expect(await theme()).toBe('dark');

        await page.getByRole('button', { name: 'Account menu' }).filter({ visible: true }).click();
        await page.getByRole('button', { name: /APPEARANCE/ }).click();
        expect(await theme()).toBe('light');
        await expect(page.getByRole('button', { name: /APPEARANCE/ })).toContainText('LIGHT · SWITCH TO DARK');

        await page.reload();
        expect(await theme()).toBe('light');
    });
});
