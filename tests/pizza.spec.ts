import { test, expect } from 'playwright-test-coverage';
import { basicInit, login, submitLogin } from './testUtils';

test('login', async ({ page }) => {
  await basicInit(page);
  await login(page, 'd@jwt.com');

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('purchase with login', async ({ page }) => {
  await basicInit(page);

  // Go to order page
  await page.getByRole('button', { name: 'Order now' }).click();

  // Create order
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Login
  await submitLogin(page, 'd@jwt.com');

  // Pay
  await expect(page.getByRole('main')).toContainText(
    'Send me those 2 pizzas right now!',
  );
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  // Check balance
  await expect(page.getByText('0.008')).toBeVisible();
});

test('view static pages', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page.getByText('The secret sauce')).toBeVisible();
  await expect(page.getByText('At JWT Pizza, our amazing')).toBeVisible();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('Mama Rucci, my my')).toBeVisible();
  await expect(page.getByText("It all started in Mama Ricci'")).toBeVisible();
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: 'Franchise' })
    .click();
  await expect(page.getByText('So you want a piece of the')).toBeVisible();
  await expect(page.getByText('Now is the time to get in on')).toBeVisible();
});

test('login as admin', async ({ page }) => {
  await basicInit(page);

  await login(page, 'a@jwt.com');

  await expect(page.getByRole('link', { name: 'AA' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();

  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
});

test('diner dashboard', async ({ page }) => {
  await basicInit(page);

  await login(page, 'd@jwt.com');

  await page.getByRole('link', { name: 'KC' }).click();

  await expect(page).toHaveURL(/\/diner-dashboard$/);
  await expect(page.getByText('Your pizza kitchen')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Kai Chen');
  await expect(page.getByRole('main')).toContainText('d@jwt.com');
  await expect(page.getByText('Here is your history of all the good times.')).toBeVisible();
  await expect(page.locator('tbody')).toContainText('23');
});

test('register', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Register' }).click();
  await expect(page.getByText('Welcome to the party')).toBeVisible();

  await page.getByPlaceholder('Full name').fill('Pizza Pat');
  await page.getByPlaceholder('Email address').fill('pat@jwt.com');
  await page.getByPlaceholder('Password').fill('secret');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByRole('link', { name: 'PP' })).toBeVisible();
});

test('franchisee dashboard create and close store', async ({ page }) => {
  await basicInit(page);

  await login(page, 'f@jwt.com');

  await page.getByLabel('Global').getByRole('link', { name: 'Franchise' }).click();
  await expect(page.getByRole('heading', { name: 'LotaPizza' })).toBeVisible();
  await expect(page.locator('tbody')).toContainText('Lehi');
  await expect(page.locator('tbody')).toContainText('Springville');

  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page.getByText('Create store')).toBeVisible();
  await page.getByPlaceholder('store name').fill('Provo');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('tbody')).toContainText('Provo');

  await page.getByRole('row', { name: /Lehi/ }).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Sorry to see you go')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('LotaPizza');
  await expect(page.getByRole('main')).toContainText('Lehi');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('tbody')).not.toContainText('Lehi');
});

test('admin create franchise', async ({ page }) => {
  await basicInit(page);

  await login(page, 'a@jwt.com');

  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();

  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await expect(page.getByText('Want to create franchise?')).toBeVisible();
  await page.getByPlaceholder('franchise name').fill('PizzaPocket');
  await page.getByPlaceholder('franchisee admin email').fill('f@jwt.com');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);
  const newRow = page.getByRole('row', { name: /PizzaPocket/ });
  await expect(newRow).toBeVisible();
  await expect(newRow).toContainText('Frank Franchisee');
});

test('delivery page after ordering', async ({ page }) => {
  await basicInit(page);

  await login(page, 'd@jwt.com');

  await page.getByRole('link', { name: 'Order' }).click();
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page).toHaveURL(/\/delivery$/);
  await expect(page.getByText('Here is your JWT Pizza!')).toBeVisible();
  const main = page.getByRole('main');
  await expect(main).toContainText('order ID: 23');
  await expect(main).toContainText('pie count: 2');
  await expect(main).toContainText('total: 0.008 ₿');
  await expect(main).toContainText('eyJpYXQ');

  await page.getByRole('button', { name: 'Verify' }).click();
  const modal = page.locator('#hs-jwt-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading')).toContainText('JWT Pizza - valid');
  await expect(modal).toContainText('Kai Chen');
  await expect(modal.locator(':scope > div')).toHaveCSS('opacity', '1');
  await modal.getByRole('button', { name: 'Close' }).click();
  await expect(modal).toBeHidden();

  await page.getByRole('button', { name: 'Order more' }).click();
  await expect(page).toHaveURL(/\/menu$/);
});
