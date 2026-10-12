import { Locator, Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';
import { basicInit, login } from './testUtils';

test('admin dashboard lists users', async ({ page }) => {
  await basicInit(page);
  const userTable = await openUserList(page);

  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await expect(userTable).toContainText('Kai Chen');
  await expect(userTable).toContainText('d@jwt.com');
  await expect(userTable).toContainText('Frank Franchisee');
  await expect(userTable).toContainText('Admin Adminson');
});

test('admin pages through users', async ({ page }) => {
  await basicInit(page, twoPagesOfUsers());
  const userTable = await openUserList(page);
  const rows = userTable.locator('tbody tr');
  const prev = userTable.getByRole('button', { name: '«' });
  const next = userTable.getByRole('button', { name: '»' });

  await expect(rows).toHaveCount(10);
  await expect(userTable).toContainText('Kai Chen');
  await expect(userTable).not.toContainText('Diner 8');
  await expect(prev).toBeDisabled();

  await next.click();
  await expect(rows).toHaveCount(5);
  await expect(userTable).toContainText('Diner 8');
  await expect(userTable).not.toContainText('Kai Chen');
  await expect(next).toBeDisabled();

  await prev.click();
  await expect(rows).toHaveCount(10);
  await expect(userTable).toContainText('Kai Chen');
});

test('admin filters users by name', async ({ page }) => {
  await basicInit(page);
  const userTable = await openUserList(page);

  // 'Chen' is in the middle of 'Kai Chen', so this only matches if the filter is wildcarded on both sides
  await filterUsers(userTable, 'Chen');
  await expect(userTable.locator('tbody tr')).toHaveCount(1);
  await expect(userTable).toContainText('Kai Chen');
  await expect(userTable).not.toContainText('Frank Franchisee');
});

test('filtering from a later page starts back at the first page', async ({ page }) => {
  await basicInit(page, twoPagesOfUsers());
  const userTable = await openUserList(page);
  await userTable.getByRole('button', { name: '»' }).click();
  await expect(userTable).toContainText('Diner 8');

  await filterUsers(userTable, 'Kai');
  await expect(userTable.locator('tbody tr')).toHaveCount(1);
  await expect(userTable).toContainText('Kai Chen');
  await expect(userTable.getByRole('button', { name: '«' })).toBeDisabled();
  await expect(userTable.getByRole('button', { name: '»' })).toBeDisabled();
});

// 3 standard users + 12 extra = 15, so 10 on the first page and 5 on the second
function twoPagesOfUsers(): User[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: String(100 + i),
    name: `Diner ${i + 1}`,
    email: `diner${i + 1}@jwt.com`,
    password: 'a',
    roles: [{ role: Role.Diner }],
  }));
}

async function filterUsers(userTable: Locator, name: string) {
  await userTable.getByRole('textbox', { name: 'Filter users' }).fill(name);
  await userTable.getByRole('button', { name: 'Apply Filter' }).click();
}

async function openUserList(page: Page) {
  await login(page, 'a@jwt.com');
  await page.getByRole('link', { name: 'Admin' }).click();
  return page.getByRole('table', { name: 'Users' });
}
