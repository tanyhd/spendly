import { test, expect, type Page } from '@playwright/test';
import { signUp, saveBudget, thisMonth, settle, isPhone } from './helpers';

const amounts = (page: Page) => page.locator('input[inputmode="decimal"]');
const status = (page: Page, text: string) => page.getByText(text).filter({ visible: true }).first();

test.describe('monthly budget', () => {
    test.beforeEach(async ({ page }) => {
        await signUp(page);
    });

    test('a new month starts from the template, saves, and stays saved after reload', async ({ page }) => {
        await page.goto('/monthly-budget');
        await settle(page);
        await expect(status(page, 'STARTER TEMPLATE · NOT SAVED')).toBeVisible();

        await amounts(page).first().fill('6500');
        await amounts(page).first().blur();
        await expect(amounts(page).first()).toHaveValue('6500.00'); // always 2 decimals
        await page.getByRole('button', { name: 'SAVE MONTH' }).click();
        await expect(page.getByRole('button', { name: '✓ SAVED' })).toBeVisible();
        await expect(status(page, 'SAVED MONTH')).toBeVisible();

        await page.reload();
        await settle(page);
        await expect(amounts(page).first()).toHaveValue('6500.00');
        await expect(status(page, 'SAVED MONTH')).toBeVisible();
    });

    test('an unsaved month is offered as a copy of last month', async ({ page }) => {
        const { year, month } = thisMonth();
        const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
        await saveBudget(page, prev.year, prev.month, 4200, [{ label: 'Rent', category: 'Housing', amount: 1500 }]);

        await page.goto('/monthly-budget');
        await settle(page);
        await expect(page.getByText(/COPIED FROM .* · NOT SAVED/).filter({ visible: true }).first()).toBeVisible();
        await expect(amounts(page).first()).toHaveValue('4200.00');
    });

    test('asks before switching month with unsaved changes', async ({ page }) => {
        await page.goto('/monthly-budget');
        await settle(page);
        await amounts(page).first().fill('100');
        await amounts(page).first().blur();
        if (!isPhoneLayout(page)) await expect(page.getByText('· UNSAVED CHANGES')).toBeVisible();

        await page.getByRole('button', { name: 'Next month' }).click();
        await expect(page.getByText(/Switching month will discard them/)).toBeVisible();
        await page.getByRole('button', { name: 'STAY' }).click();
        await expect(amounts(page).first()).toHaveValue('100.00');

        const label = await page.getByText(/^[A-Z]{3} \d{4}$/).first().innerText();
        await page.getByRole('button', { name: 'Next month' }).click();
        await page.getByRole('button', { name: /DISCARD & SWITCH/ }).click();
        await expect(page.getByText(label, { exact: true })).toBeHidden();
    });

    test('asks before leaving the page with unsaved changes, and not once saved', async ({ page }, info) => {
        await page.goto('/monthly-budget');
        await settle(page);
        await amounts(page).first().fill('100');
        await amounts(page).first().blur();

        const dashLink = isPhone(info) ? page.getByRole('link', { name: 'LOG', exact: true }) : page.getByRole('link', { name: /DASHBOARD/ });
        await dashLink.click();
        await expect(page.getByRole('alertdialog', { name: 'Unsaved changes' })).toBeVisible();
        await expect(page).toHaveURL(/\/monthly-budget$/);
        await page.getByRole('button', { name: 'STAY' }).click();

        await page.getByRole('button', { name: 'SAVE MONTH' }).click();
        await expect(page.getByRole('button', { name: '✓ SAVED' })).toBeVisible();
        await dashLink.click();
        await expect(page).not.toHaveURL(/\/monthly-budget$/);
    });
});

function isPhoneLayout(page: Page) {
    return (page.viewportSize()?.width ?? 1280) < 720;
}
