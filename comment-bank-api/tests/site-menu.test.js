// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let applyMenuState;
let bindLogout;
let getMenuState;
let initializeMenu;
let watchForMenu;

const buildMenu = () => {
  document.body.innerHTML = `
    <ul data-reportgen-menu>
      <li data-auth-menu-item hidden><a href="settings.html">Settings</a></li>
      <li data-admin-menu-item hidden><a href="adminpage.html">Admin</a></li>
      <li data-auth-menu-item hidden><a href="login.html" data-menu-logout>Logout</a></li>
    </ul>
  `;
  return document.querySelector('[data-reportgen-menu]');
};

beforeAll(async () => {
  globalThis.__REPORTGEN_MENU_DISABLE_AUTO_INIT__ = true;
  ({
    applyMenuState,
    bindLogout,
    getMenuState,
    initializeMenu,
    watchForMenu
  } = await import('../public/site-menu.js'));
});

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('site menu helpers', () => {
  it('shows settings and logout for authenticated users', () => {
    const menu = buildMenu();

    const state = applyMenuState(menu, { username: 'teacher', isAdmin: false });

    expect(state).toEqual({ isAuthenticated: true, isAdmin: false });
    expect(menu.querySelectorAll('[data-auth-menu-item]')[0].hidden).toBe(false);
    expect(menu.querySelectorAll('[data-auth-menu-item]')[1].hidden).toBe(false);
    expect(menu.querySelector('[data-admin-menu-item]').hidden).toBe(true);
  });

  it('shows the admin link only for admin users', () => {
    const menu = buildMenu();

    const state = applyMenuState(menu, { username: 'admin', isAdmin: true });

    expect(state).toEqual({ isAuthenticated: true, isAdmin: true });
    expect(menu.querySelector('[data-admin-menu-item]').hidden).toBe(false);
  });

  it('keeps authenticated links hidden for anonymous users', () => {
    const menu = buildMenu();

    const state = applyMenuState(menu, null);

    expect(state).toEqual({ isAuthenticated: false, isAdmin: false });
    expect(menu.querySelectorAll('[data-auth-menu-item]')[0].hidden).toBe(true);
    expect(menu.querySelector('[data-admin-menu-item]').hidden).toBe(true);
  });

  it('initializes menu state from /api/user-info', async () => {
    const menu = buildMenu();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ username: 'admin', isAdmin: true })
    });

    const initialized = await initializeMenu({
      documentRef: document,
      fetchImpl,
      locationRef: { href: '' }
    });

    expect(initialized).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('/api/user-info', { credentials: 'include' });
    expect(menu.querySelector('[data-admin-menu-item]').hidden).toBe(false);
  });

  it('initializes menus that are inserted after page load', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ username: 'admin', isAdmin: true })
    });

    const observer = watchForMenu({
      documentRef: document,
      fetchImpl,
      locationRef: { href: '' },
      MutationObserverImpl: MutationObserver
    });

    const wrapper = document.createElement('div');
    document.body.appendChild(wrapper);
    wrapper.innerHTML = `
      <ul data-reportgen-menu>
        <li data-auth-menu-item hidden><a href="settings.html">Settings</a></li>
        <li data-admin-menu-item hidden><a href="adminpage.html">Admin</a></li>
        <li data-auth-menu-item hidden><a href="login.html" data-menu-logout>Logout</a></li>
      </ul>
    `;

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[data-admin-menu-item]').hidden).toBe(false);
    observer?.disconnect();
  });

  it('posts logout and redirects to login', async () => {
    const menu = buildMenu();
    const locationRef = { href: '' };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    bindLogout(menu, { fetchImpl, locationRef });
    menu.querySelector('[data-menu-logout]').dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchImpl).toHaveBeenCalledWith('/api/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    expect(locationRef.href).toBe('login.html');
  });

  it('maps admin state consistently', () => {
    expect(getMenuState({ isAdmin: true })).toEqual({ isAuthenticated: true, isAdmin: true });
    expect(getMenuState({ isAdmin: false })).toEqual({ isAuthenticated: true, isAdmin: false });
    expect(getMenuState(null)).toEqual({ isAuthenticated: false, isAdmin: false });
  });
});
