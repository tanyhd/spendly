import { test, expect } from '@playwright/test';
import { PASSWORD, signUp } from './helpers';

test.describe('sign up, sign in, sign out', () => {
    test('signs up through the form and lands on the dashboard', async ({ page }) => {
        const email = `e2e.form.${Date.now()}@example.test`;
        await page.goto('/register');
        await page.getByPlaceholder('Your full name').fill('Jamie Lee');
        await page.getByPlaceholder('you@example.com').fill(email);
        await page.getByPlaceholder('Create a password').fill(PASSWORD);
        await page.getByPlaceholder('Repeat your password').fill(PASSWORD);
        await page.getByRole('button', { name: /CREATE ACCOUNT/ }).click();
        await page.waitForURL('**/dashboard');
        await expect(page.getByRole('button', { name: 'Account menu' }).filter({ visible: true })).toHaveText('JL');
    });

    test('refuses mismatched passwords before sending anything', async ({ page }) => {
        await page.goto('/register');
        await page.getByPlaceholder('Your full name').fill('Jamie Lee');
        await page.getByPlaceholder('you@example.com').fill('mismatch@example.test');
        await page.getByPlaceholder('Create a password').fill(PASSWORD);
        await page.getByPlaceholder('Repeat your password').fill('Different123!');
        await page.getByRole('button', { name: /CREATE ACCOUNT/ }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'Passwords do not match' })).toBeVisible();
        await expect(page).toHaveURL(/\/register$/);
    });

    test('shows an error for a wrong password, then signs in to the chosen default page', async ({ page, context }) => {
        const { email } = await signUp(page);
        await page.request.put('/api/settings/preferences', { data: { displayName: '', defaultPage: 'daily-log' } });
        await context.clearCookies();

        await page.goto('/login');
        await page.getByPlaceholder('you@example.com').fill(email);
        await page.getByPlaceholder('Your password').fill('WrongPass123');
        await page.getByRole('button', { name: /SIGN IN/ }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'Invalid email or password' })).toBeVisible();

        await page.getByPlaceholder('Your password').fill(PASSWORD);
        await page.getByRole('button', { name: /SIGN IN/ }).click();
        await page.waitForURL('**/daily-log');
    });

    test('signing out ends the session and protected pages send you to login', async ({ page }) => {
        await signUp(page);
        await page.goto('/dashboard');
        await page.getByRole('button', { name: 'Account menu' }).filter({ visible: true }).click();
        await page.getByRole('button', { name: 'SIGN OUT' }).click();
        await page.waitForURL('**/login');

        await page.goto('/monthly-budget');
        await expect(page).toHaveURL(/\/login$/);
    });

    test('a signed-in user visiting /login goes to the dashboard', async ({ page }) => {
        await signUp(page);
        await page.goto('/login');
        await expect(page).toHaveURL(/\/dashboard$/);
    });
});
