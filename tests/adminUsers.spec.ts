import { Page } from '@playwright/test';
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

async function openUserList(page: Page) {
  await login(page, 'a@jwt.com');
  await page.getByRole('link', { name: 'Admin' }).click();
  return page.getByRole('table', { name: 'Users' });
}
