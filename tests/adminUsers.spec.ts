import { test, expect } from 'playwright-test-coverage';
import { basicInit, login } from './testUtils';

test('admin dashboard lists users', async ({ page }) => {
  await basicInit(page);
  await login(page, 'a@jwt.com');
  await page.getByRole('link', { name: 'Admin' }).click();

  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  const userTable = page.getByRole('table', { name: 'Users' });
  await expect(userTable).toContainText('Kai Chen');
  await expect(userTable).toContainText('d@jwt.com');
  await expect(userTable).toContainText('Frank Franchisee');
  await expect(userTable).toContainText('Admin Adminson');
});
