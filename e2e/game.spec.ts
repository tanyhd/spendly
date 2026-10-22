import { test, expect } from '@playwright/test';
import { isPhone } from './helpers';

test.describe('login page game', () => {
    test('starts from the hint, launches, and quits back to the form', async ({ page }, info) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');
        await page.getByRole('button', { name: isPhone(info) ? /TAP THE CURSOR/ : /BORED\?/ }).click();

        await expect(page.getByText('CLEARED 0/42')).toBeVisible();
        await expect(page.getByText('■■■')).toBeVisible();

        if (isPhone(info)) {
            await expect(page.getByText('TAP TO LAUNCH · DRAG TO MOVE')).toBeVisible();
            await page.getByRole('button', { name: /QUIT/ }).click();
        } else {
            await expect(page.getByText(/SPACE \/ CLICK TO LAUNCH/)).toBeVisible();
            await page.keyboard.press(' ');
            await expect(page.getByText(/SPACE \/ CLICK TO LAUNCH/)).toBeHidden(); // ball in play
            await page.keyboard.press('Escape');
        }
        await expect(page.getByText('CLEARED 0/42')).toBeHidden();
        await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    });

    test('the theme button on the login page switches to light', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');
        await page.getByRole('button', { name: /◐ LIGHT/ }).click();
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
    });
});
