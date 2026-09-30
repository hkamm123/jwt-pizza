import { test, expect } from 'playwright-test-coverage';

test('purchase with login', async ({ page }) => {
await page.goto('http://localhost:5173/');
await page.getByRole('link', { name: 'Login' }).click();
await page.getByRole('textbox', { name: 'Email address' }).fill('t@jwt.com');
await page.getByRole('textbox', { name: 'Password' }).click();
await page.getByRole('textbox', { name: 'Password' }).fill('test');
await page.getByRole('button', { name: 'Login' }).click();
await page.getByRole('button', { name: 'Order now' }).click();
await page.getByRole('combobox').selectOption('1');
await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
await page.getByRole('button', { name: 'Checkout' }).click();
await page.getByRole('button', { name: 'Pay now' }).click();
await page.getByRole('button', { name: 'Verify' }).click();
});