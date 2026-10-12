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

test('pagination shows the current page number', async ({ page }) => {
  await basicInit(page, twoPagesOfUsers());
  const userTable = await openUserList(page);
  const next = userTable.getByRole('button', { name: '»' });
  const pager = userTable.getByRole('cell').filter({ has: page.getByRole('button', { name: '»' }) });

  await expect(pager).toContainText('Page 1');

  await next.click();
  await expect(pager).toContainText('Page 2');

  await userTable.getByRole('button', { name: '«' }).click();
  await expect(pager).toContainText('Page 1');

  await next.click();
  await filterUsers(userTable, 'Kai');
  await expect(pager).toContainText('Page 1');
});

test('non-admin does not see the user list', async ({ page }) => {
  await basicInit(page);
  await login(page, 'd@jwt.com');

  await page.getByRole('link', { name: 'KC' }).click();
  await expect(page.getByText('Your pizza kitchen')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Users' })).not.toBeVisible();

  await page.goto('/admin-dashboard');
  await expect(page.getByText('Oops')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Users' })).not.toBeVisible();
});

test('admin can delete user', async ({ page }) => {
  await basicInit(page);
  const userTable = await openUserList(page);
  const deleteButton = userTable
    .getByRole('row', { name: /d@jwt\.com/ })
    .getByRole('button', { name: 'Delete' });

  await expect(deleteButton).toBeVisible();
  await expect(deleteButton).toBeEnabled();
  await deleteUser(page, /d@jwt\.com/);
  await expect(userTable).toBeVisible();
  const deletedRow = userTable.getByRole('row', { name: /d@jwt\.com/ });
  await expect(deletedRow).not.toBeVisible();

  await page.getByRole('link', { name: 'Logout' }).click();
  await openUserList(page);
  await expect(userTable).toContainText('Frank Franchisee');
  await expect(deletedRow).not.toBeVisible();
});

test('deleting the last user on a page goes back a page', async ({ page }) => {
  // 3 standard users + 8 extra = 11, so Diner 8 is alone on the second page
  await basicInit(page, extraDiners(8));
  const userTable = await openUserList(page);
  const rows = userTable.locator('tbody tr');
  const pager = userTable.getByRole('cell').filter({ has: page.getByRole('button', { name: '»' }) });

  await userTable.getByRole('button', { name: '»' }).click();
  await expect(rows).toHaveCount(1);
  await deleteUser(page, /diner8@jwt\.com/);

  await expect(pager).toContainText('Page 1');
  await expect(rows).toHaveCount(10);
  await expect(userTable.getByRole('button', { name: '»' })).toBeDisabled();
});

test('a failed delete shows an error and keeps the user', async ({ page }) => {
  await basicInit(page);
  // Registered after basicInit, so Playwright tries it before the standard mock
  await page.route(/\/api\/user\/3$/, (route) =>
    route.fulfill({ status: 500, json: { message: 'unable to delete user' } }),
  );
  const userTable = await openUserList(page);

  await deleteUser(page, /d@jwt\.com/);

  await expect(page.getByRole('alert')).toContainText('unable to delete user');
  await expect(userTable).toContainText('Kai Chen');
});

test('cancelling the delete dialog keeps the user', async ({ page }) => {
  await basicInit(page);
  const deleteRequests: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'DELETE' && req.url().includes('/api/user/')) {
      deleteRequests.push(req.url());
    }
  });
  const userTable = await openUserList(page);

  await userTable.getByRole('row', { name: /d@jwt\.com/ }).getByRole('button', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Kai Chen');
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await expect(dialog).toBeHidden();
  await expect(userTable).toContainText('Kai Chen');
  expect(deleteRequests).toEqual([]);
});

test('admin cannot delete their own account', async ({ page }) => {
  await basicInit(page);
  const userTable = await openUserList(page);
  const deleteButtonFor = (email: RegExp) =>
    userTable.getByRole('row', { name: email }).getByRole('button', { name: 'Delete' });

  // Check another row first so we know the list has loaded
  await expect(deleteButtonFor(/d@jwt\.com/)).toBeVisible();
  await expect(deleteButtonFor(/a@jwt\.com/)).toHaveCount(0);
});

// 3 standard users + 12 extra = 15, so 10 on the first page and 5 on the second
function twoPagesOfUsers(): User[] {
  return extraDiners(12);
}

function extraDiners(count: number): User[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(100 + i),
    name: `Diner ${i + 1}`,
    email: `diner${i + 1}@jwt.com`,
    password: 'a',
    roles: [{ role: Role.Diner }],
  }));
}

// Click the Delete button on the row matching email, then confirm in the dialog
async function deleteUser(page: Page, email: RegExp) {
  const userTable = page.getByRole('table', { name: 'Users' });
  await userTable.getByRole('row', { name: email }).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
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
