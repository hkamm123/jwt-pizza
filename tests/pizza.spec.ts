import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Franchise, Role, Store, User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {
    'd@jwt.com': {
      id: '3',
      name: 'Kai Chen',
      email: 'd@jwt.com',
      password: 'a',
      roles: [{ role: Role.Diner }],
    },
    'a@jwt.com': {
      id: '4',
      name: 'Admin Adminson',
      email: 'a@jwt.com',
      password: 'a',
      roles: [{ role: Role.Admin }],
    },
    'f@jwt.com': {
      id: '5',
      name: 'Frank Franchisee',
      email: 'f@jwt.com',
      password: 'a',
      roles: [{ role: Role.Franchisee, objectId: '2' }],
    },
  };

  // Login (PUT), register (POST), or logout (DELETE)
  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();

    if (method === 'DELETE') {
      loggedInUser = undefined;
      await route.fulfill({ json: { message: 'logout successful' } });
      return;
    }

    if (method === 'POST') {
      const registerReq = route.request().postDataJSON();
      const newUser: User = {
        id: String(Object.keys(validUsers).length + 10),
        name: registerReq.name,
        email: registerReq.email,
        password: registerReq.password,
        roles: [{ role: Role.Diner }],
      };
      validUsers[newUser.email!] = newUser;
      loggedInUser = newUser;
      await route.fulfill({ json: { user: newUser, token: 'abcdef' } });
      return;
    }

    expect(method).toBe('PUT');
    const loginReq = route.request().postDataJSON();
    const user = validUsers[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = user;
    await route.fulfill({ json: { user: loggedInUser, token: 'abcdef' } });
  });

  // Return the currently logged in user
  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  // A standard menu
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      {
        id: 1,
        title: 'Veggie',
        image: 'pizza1.png',
        price: 0.0038,
        description: 'A garden of delight',
      },
      {
        id: 2,
        title: 'Pepperoni',
        image: 'pizza2.png',
        price: 0.0042,
        description: 'Spicy treat',
      },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  // Standard franchises and stores. Shared by the routes below so that
  // creating or closing a store changes what later requests return.
  const franchises: Franchise[] = [
    {
      id: '2',
      name: 'LotaPizza',
      admins: [{ id: '5', name: 'Frank Franchisee', email: 'f@jwt.com' }],
      stores: [
        { id: '4', name: 'Lehi', totalRevenue: 0.05 },
        { id: '5', name: 'Springville', totalRevenue: 0.02 },
        { id: '6', name: 'American Fork', totalRevenue: 0.01 },
      ],
    },
    { id: '3', name: 'PizzaCorp', stores: [{ id: '7', name: 'Spanish Fork' }] },
    { id: '4', name: 'topSpot', stores: [] },
  ];

  // List all franchises (GET) or create a franchise (POST)
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const method = route.request().method();

    if (method === 'POST') {
      const franchiseReq = route.request().postDataJSON();
      const admins = franchiseReq.admins.map((a: User) => {
        const user = validUsers[a.email!];
        return { id: user?.id, name: user?.name, email: a.email };
      });
      const franchise: Franchise = { ...franchiseReq, id: '98', admins, stores: [] };
      franchises.push(franchise);
      await route.fulfill({ json: franchise });
      return;
    }

    expect(method).toBe('GET');
    await route.fulfill({ json: { franchises, more: false } });
  });

  // GET /api/franchise/:userId              -> the user's franchises
  // POST /api/franchise/:franchiseId/store   -> create a store
  // DELETE /api/franchise/:franchiseId/store/:storeId -> close a store
  await page.route(/\/api\/franchise\/(\d+)(\/store(\/(\d+))?)?$/, async (route) => {
    const [, id, storePath, , storeId] = new URL(route.request().url()).pathname.match(
      /\/api\/franchise\/(\d+)(\/store(\/(\d+))?)?$/,
    )!;
    const method = route.request().method();

    if (!storePath) {
      expect(method).toBe('GET');
      const userFranchises = franchises.filter((f) => f.admins?.some((a) => a.id === id));
      await route.fulfill({ json: userFranchises });
      return;
    }

    const franchise = franchises.find((f) => f.id === id)!;
    if (method === 'POST') {
      const store: Store = { ...route.request().postDataJSON(), id: '99', totalRevenue: 0 };
      franchise.stores.push(store);
      await route.fulfill({ json: store });
      return;
    }

    expect(method).toBe('DELETE');
    franchise.stores = franchise.stores.filter((s) => s.id !== storeId);
    await route.fulfill({ json: { message: 'store deleted' } });
  });

  // Get order history, or order a pizza.
  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() === 'GET') {
      const historyRes = {
        id: '1',
        dinerId: loggedInUser?.id,
        orders: [
          {
            id: 23,
            franchiseId: 2,
            storeId: 4,
            date: '2024-06-05T05:14:40.000Z',
            items: [{ menuId: 1, description: 'Veggie', price: 0.0038 }],
          },
        ],
      };
      await route.fulfill({ json: historyRes });
      return;
    }

    const orderReq = route.request().postDataJSON();
    const orderRes = {
      order: { ...orderReq, id: 23 },
      jwt: 'eyJpYXQ',
    };
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ json: orderRes });
  });

  // Verify an order's JWT with the pizza factory
  await page.route('*/**/api/order/verify', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toMatchObject({ jwt: 'eyJpYXQ' });
    await route.fulfill({
      json: {
        message: 'valid',
        payload: { vendor: { id: 'hkamm123', name: 'Hyrum Kammerman' }, diner: { id: 3, name: 'Kai Chen' } },
      },
    });
  });

  await page.goto('/');
}

// Fill in and submit the login form that is already on screen, then wait
// for the header to show the user as logged in.
async function submitLogin(page: Page, email: string, password = 'a') {
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
}

// Log in starting from the header's Login link.
async function login(page: Page, email: string, password = 'a') {
  await page.getByRole('link', { name: 'Login' }).click();
  await submitLogin(page, email, password);
}

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
