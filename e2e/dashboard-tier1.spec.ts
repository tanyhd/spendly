import { test, expect, type Page } from '@playwright/test';
import { signUp, settle, addExpense, dayInt, thisMonth, isPhone } from './helpers';

async function putPlan(page: Page, year: number, month: number, data: unknown) {
    const res = await page.request.put(`/api/budget/${year}/${month}`, { data });
    expect(res.ok()).toBeTruthy();
}

const D = new Date().getDate();

test.describe('dashboard · periods', () => {
    test.beforeEach(async ({ page }) => {
        await signUp(page);
    });

    test('switches between week, month, quarter and year, and steps back and forth', async ({ page }) => {
        const { year, month } = thisMonth();
        await putPlan(page, year, month, { income: [{ label: 'Salary', category: 'Employment', amount: 5000 }] });
        await addExpense(page, dayInt(), 'Food', 30, 'Lunch');
        await page.goto('/dashboard');
        await settle(page);

        await page.getByRole('button', { name: 'WEEK', exact: true }).click();
        await expect(page.getByText('Spent this week', { exact: true })).toBeVisible();
        await expect(page.getByText('DAILY LOG ONLY · INCOME IS PLANNED MONTHLY')).toBeVisible();
        await expect(page.getByText('Net savings', { exact: true })).toHaveCount(0); // no income for a week

        await page.getByRole('button', { name: 'QUARTER', exact: true }).click();
        await expect(page.getByText(/^Q[1-4] \d{4}$/)).toBeVisible();
        await expect(page.getByText('1 OF 3 MONTHS BUDGETED')).toBeVisible();
        await expect(page.getByTestId('period-bars')).toContainText('INCOME VS SPENDING');

        const label = await page.getByText(/^Q[1-4] \d{4}$/).innerText();
        await page.getByRole('button', { name: 'Previous quarter' }).click();
        await expect(page.getByText(label, { exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Next quarter' }).click();
        await expect(page.getByText(label, { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'YEAR', exact: true }).click();
        await expect(page.getByText(`1 OF 12 MONTHS BUDGETED`)).toBeVisible();
        await page.getByRole('button', { name: 'MONTH', exact: true }).click();
        await expect(page.getByText('SAVED BUDGET')).toBeVisible();
    });
});

test.describe('dashboard · left to spend, bills and insights', () => {
    test.beforeEach(async ({ page }) => {
        await signUp(page);
    });

    test('without limits the panel offers to set them', async ({ page }) => {
        await page.goto('/dashboard');
        await settle(page);
        await expect(page.getByTestId('left-to-spend')).toContainText('SET LIMITS');
    });

    test('shows what is left of the limits, per category, with a heads-up when over', async ({ page }) => {
        const { year, month } = thisMonth();
        await putPlan(page, year, month, { categoryBudgets: [{ category: 'Food', amount: 100 }, { category: 'Shopping', amount: 50 }] });
        await addExpense(page, dayInt(), 'Food', 40, 'Lunch');
        await addExpense(page, dayInt(), 'Shopping', 56.2, 'Shoes');
        await addExpense(page, dayInt(), 'Health', 10, 'Pharmacy');
        await page.goto('/dashboard');
        await settle(page);

        const panel = page.getByTestId('left-to-spend');
        await expect(panel).toContainText('53.80');                    // 150 − 96.20
        await expect(panel).toContainText('96.20 SPENT OF 150.00 BUDGETED · 10.00 UNBUDGETED');
        await expect(panel).toContainText('OVER 6.20');
        await expect(panel).toContainText('60.00 LEFT');
        await expect(panel).toContainText('NO LIMIT');
        await expect(page.getByTestId('insights')).toContainText('Shopping is $6.20 over budget');
    });

    test('coming up lists bills by due day; ticking one marks it paid everywhere', async ({ page }) => {
        test.skip(D === 1, 'nothing can be overdue on the 1st');
        const { year, month } = thisMonth();
        await putPlan(page, year, month, {
            fixedExpenses: [
                { id: 'tax', label: 'Taxes', category: 'Tax', amount: 400, dueDay: 1 },
                { id: 'ins', label: 'Insurance', category: 'Insurance', amount: 350, dueDay: D },
                { id: 'misc', label: 'Misc', category: 'Other', amount: 20 },  // no due day: only in totals
            ],
        });
        await page.goto('/dashboard');
        await settle(page);

        const coming = page.getByTestId('coming-up');
        await expect(coming).toContainText('You have 1 bill due in the next 7 days for $350.00, plus 1 overdue ($400.00).');
        await expect(coming.getByTestId('bill-row').filter({ hasText: 'Taxes' })).toContainText(/\d+D OVERDUE/);
        await expect(coming.getByTestId('bill-row').filter({ hasText: 'Insurance' })).toContainText('TODAY');
        await expect(coming).not.toContainText('Misc');
        await expect(page.getByTestId('bills-foot')).toContainText('LEFT TO PAY 770.00');
        await expect(page.getByTestId('insights')).toContainText("Taxes ($400.00) is");

        const saved = page.waitForResponse(r => r.url().includes('/bills/tax') && r.request().method() === 'PATCH');
        await page.getByRole('checkbox', { name: 'Taxes paid' }).check();
        expect((await saved).ok()).toBeTruthy();
        await expect(page.getByTestId('bills-foot')).toContainText('LEFT TO PAY 370.00');
        await expect(page.getByTestId('bills-foot')).toContainText('PAID 400.00');
        await expect(page.getByTestId('insights')).not.toContainText('overdue');

        // The Budget page shows the same tick
        await page.goto('/monthly-budget');
        await settle(page);
        await expect(page.getByRole('checkbox', { name: 'Taxes paid' })).toBeChecked();
    });

    test('says so when every bill this month is paid', async ({ page }) => {
        const { year, month } = thisMonth();
        await putPlan(page, year, month, { fixedExpenses: [{ id: 'rent', label: 'Rent', category: 'Housing', amount: 2000, dueDay: 28, paid: true }] });
        await page.goto('/dashboard');
        await settle(page);
        await expect(page.getByTestId('coming-up')).toContainText(/Every bill for [A-Z]{3} is paid\. Nice\./);
    });

    test('"VIEW ALL" opens all expenses', async ({ page }, info) => {
        await addExpense(page, dayInt(), 'Food', 5, 'Snack');
        await page.goto('/dashboard');
        await settle(page);
        await page.getByRole('link', { name: /VIEW ALL/ }).click();
        await expect(page).toHaveURL(/\/daily-log\/all\?from=\d{8}&to=\d{8}$/); // this month's dates
        if (!isPhone(info)) await expect(page.getByRole('link', { name: 'ALL EXPENSES' })).toHaveAttribute('aria-current', 'page');
    });
});
