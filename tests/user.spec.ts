import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { basicInit, login } from './testUtils';

const diner = { name: 'pizza diner', email: 'pd@jwt.com', password: 'diner' };

test('update user name', async ({ page }) => {
  await registerAndOpenDashboard(page);

  await editUser(page, { name: 'pizza dinerx' });
  await expect(page.getByRole('main')).toContainText('pizza dinerx');

  await reloginAndOpenDashboard(page, diner.email, diner.password);
  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});

test('update user email', async ({ page }) => {
  await registerAndOpenDashboard(page);

  await editUser(page, { email: 'newpd@jwt.com' });
  await expect(page.getByRole('main')).toContainText('newpd@jwt.com');

  await reloginAndOpenDashboard(page, 'newpd@jwt.com', diner.password);
  await expect(page.getByRole('main')).toContainText('newpd@jwt.com');
});

test('update user password', async ({ page }) => {
  await registerAndOpenDashboard(page);

  await editUser(page, { password: 'newpassword' });

  await reloginAndOpenDashboard(page, diner.email, 'newpassword');
  await expect(page.getByRole('main')).toContainText(diner.name);
});

async function registerAndOpenDashboard(page: Page) {
  await basicInit(page);

  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill(diner.name);
  await page.getByRole('textbox', { name: 'Email address' }).fill(diner.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(diner.password);
  await page.getByRole('button', { name: 'Register' }).click();

  await openDashboard(page);
  await expect(page.getByRole('main')).toContainText(diner.name);
}

// The header link shows the user's initials, which none of the tests change.
async function openDashboard(page: Page) {
  await page.getByRole('link', { name: 'pd' }).click();
}

// Only the fields passed in are changed; the rest keep their current values.
async function editUser(page: Page, changes: { name?: string; email?: string; password?: string }) {
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');

  const dialog = page.getByRole('dialog');
  for (const [field, value] of Object.entries(changes)) {
    await dialog.getByLabel(`${field}:`).fill(value);
  }
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });
}

async function reloginAndOpenDashboard(page: Page, email: string, password: string) {
  await page.getByRole('link', { name: 'Logout' }).click();
  await login(page, email, password);
  await openDashboard(page);
}
