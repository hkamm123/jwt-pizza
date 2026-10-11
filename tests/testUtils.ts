import { Page } from '@playwright/test';
import { expect } from 'playwright-test-coverage';
import { Franchise, Role, Store, User } from '../src/service/pizzaService';

export async function basicInit(page: Page) {
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

  // Update a user. The frontend leaves the password out when it isn't
  // changed, so only overwrite the fields that were actually sent.
  await page.route(/\/api\/user\/(\d+)$/, async (route) => {
    expect(route.request().method()).toBe('PUT');
    const userId = new URL(route.request().url()).pathname.split('/').pop();
    const user = Object.values(validUsers).find((u) => u.id === userId);
    if (!user || user.id !== loggedInUser?.id) {
      await route.fulfill({ status: 403, json: { message: 'unauthorized' } });
      return;
    }

    const { name, email, password } = route.request().postDataJSON();
    // validUsers is keyed by email, so move the entry if the email changes
    delete validUsers[user.email!];
    Object.assign(user, { name, email }, password ? { password } : {});
    validUsers[user.email!] = user;
    await route.fulfill({ json: { user, token: 'ghijkl' } });
  });

  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe('GET');
    const params = new URL(route.request().url()).searchParams;
    const pageNum = Number(params.get('page') ?? 0);
    const limit = Number(params.get('limit') ?? 10);
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameFilter = new RegExp('^' + (params.get('name') ?? '*').split('*').map(escape).join('.*') + '$', 'i');

    const matching = Object.values(validUsers)
      .filter((u) => nameFilter.test(u.name!))
      .map(({ password, ...u }) => u);
    const users = matching.slice(pageNum * limit, (pageNum + 1) * limit);
    await route.fulfill({ json: { users, more: matching.length > (pageNum + 1) * limit } });
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
export async function submitLogin(page: Page, email: string, password = 'a') {
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
}

// Log in starting from the header's Login link.
export async function login(page: Page, email: string, password = 'a') {
  await page.getByRole('link', { name: 'Login' }).click();
  await submitLogin(page, email, password);
}
