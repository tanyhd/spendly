import { test, expect } from '@playwright/test';
import { signUp, addExpense, dayInt, settle, PASSWORD } from './helpers';

test.describe('settings', () => {
    test('a display name shows in the account menu', async ({ page }) => {
        await signUp(page, 'Alex Tan');
        await page.goto('/settings');
        await settle(page);
        await page.getByPlaceholder('Alex Tan').fill('Lexi');
        await expect(page.getByText('UNSAVED CHANGES')).toBeVisible();
        await page.getByRole('button', { name: 'SAVE PREFERENCES' }).click();
        await expect(page.getByRole('button', { name: '✓ SAVED!' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Account menu' }).filter({ visible: true })).toHaveText('L');
    });

    test('appearance applies instantly and SYSTEM follows the device', async ({ page }) => {
        await signUp(page);
        await page.goto('/settings');
        await settle(page);
        const theme = () => page.evaluate(() => document.documentElement.dataset.theme);

        await page.getByRole('radio', { name: /LIGHT/ }).click();
        expect(await theme()).toBe('light');
        await page.getByRole('radio', { name: 'SYSTEM' }).click();
        await page.emulateMedia({ colorScheme: 'dark' });
        await expect.poll(theme).toBe('dark');
        await page.emulateMedia({ colorScheme: 'light' });
        await expect.poll(theme).toBe('light');
    });

    test('changes the password: wrong current password is refused, the new one works', async ({ page, context }) => {
        const { email } = await signUp(page);
        await page.goto('/settings');
        await settle(page);

        await page.getByPlaceholder('Enter current password').fill('WrongPass123');
        await page.getByPlaceholder('At least 8 characters').fill('NewPass123!');
        await page.getByPlaceholder('Repeat new password').fill('NewPass123!');
        await page.getByRole('button', { name: 'UPDATE PASSWORD' }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'Current password is incorrect' })).toBeVisible();

        await page.getByPlaceholder('Enter current password').fill(PASSWORD);
        await page.getByPlaceholder('At least 8 characters').fill('NewPass123!');
        await page.getByPlaceholder('Repeat new password').fill('NewPass123!');
        await page.getByRole('button', { name: 'UPDATE PASSWORD' }).click();
        await expect(page.getByRole('button', { name: '✓ UPDATED!' })).toBeVisible();

        await context.clearCookies();
        const res = await page.request.post('/api/auth/login', { data: { email, password: 'NewPass123!' } });
        expect(res.ok()).toBeTruthy();
    });

    test('previews and clears a week, then deletes everything only after typing DELETE', async ({ page }) => {
        await signUp(page);
        await addExpense(page, dayInt(0), 'Food', 10);
        await addExpense(page, dayInt(0), 'Food', 5.5);
        await page.goto('/settings');
        await settle(page);
        await page.getByRole('button', { name: 'DATA MANAGEMENT' }).click();

        await expect(page.getByText('2 daily entries · $15.50').first()).toBeVisible();
        await page.getByRole('button', { name: 'CLEAR WEEK' }).click();
        await expect(page.getByText(/Delete 2 entries \(\$15\.50\)/)).toBeVisible();
        await page.getByRole('button', { name: 'YES, CLEAR WEEK' }).click();
        await expect(page.getByText(/✓ Cleared 2 entries from/)).toBeVisible();

        await addExpense(page, dayInt(0), 'Food', 1);
        await page.reload();
        await settle(page);
        await page.getByRole('button', { name: 'DATA MANAGEMENT' }).click();
        const deleteAll = page.getByRole('button', { name: 'DELETE ALL DATA' });
        await expect(deleteAll).toBeDisabled();
        await page.getByPlaceholder('DELETE').fill('DELETE');
        await deleteAll.click();
        await expect(page.getByText('✓ Deleted 1 entry and 0 budgets. Your account is still active.')).toBeVisible();
    });
});
