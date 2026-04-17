export const getMenuState = (userInfo) => ({
  isAuthenticated: Boolean(userInfo),
  isAdmin: Boolean(userInfo?.isAdmin)
});

const setHidden = (element, hidden) => {
  if (element) {
    element.hidden = hidden;
  }
};

export const applyMenuState = (menu, userInfo) => {
  const state = getMenuState(userInfo);

  menu.querySelectorAll('[data-auth-menu-item]').forEach((item) => {
    setHidden(item, !state.isAuthenticated);
  });

  menu.querySelectorAll('[data-admin-menu-item]').forEach((item) => {
    setHidden(item, !state.isAdmin);
  });

  return state;
};

export const getCurrentPage = (locationRef = globalThis.location) => {
  const pathname = locationRef?.pathname || '';
  const current = pathname.split('/').pop();
  return current || 'index.html';
};

export const applyActiveMenuState = (menu, locationRef = globalThis.location) => {
  const currentPage = getCurrentPage(locationRef);
  let matched = false;

  menu.querySelectorAll('a').forEach((link) => {
    const item = link.closest('li');
    const href = link.getAttribute('href')?.split(/[?#]/)[0] || '';
    const isActive = !link.hasAttribute('data-menu-logout') && href === currentPage;

    link.classList.toggle('is-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
    item?.classList.toggle('has-active-link', isActive);
    matched = matched || isActive;
  });

  return matched;
};

export const bindLogout = (menu, { fetchImpl = globalThis.fetch, locationRef = globalThis.location } = {}) => {
  const logoutLink = menu.querySelector('[data-menu-logout]');
  if (!logoutLink || logoutLink.dataset.logoutBound === 'true') {
    return false;
  }

  logoutLink.dataset.logoutBound = 'true';
  logoutLink.addEventListener('click', async (event) => {
    event.preventDefault();
    try {
      const response = await fetchImpl('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        locationRef.href = 'login.html';
        return;
      }
      globalThis.alert?.('Failed to logout.');
    } catch (error) {
      console.error('Logout error:', error);
      globalThis.alert?.('Failed to logout.');
    }
  });

  return true;
};

export const initializeMenu = async ({
  documentRef = globalThis.document,
  fetchImpl = globalThis.fetch,
  locationRef = globalThis.location
} = {}) => {
  if (!documentRef || !fetchImpl) {
    return false;
  }

  const menu = documentRef.querySelector('[data-reportgen-menu]');
  if (!menu) {
    return false;
  }
  if (menu.dataset.menuInitialized === 'true') {
    applyActiveMenuState(menu, locationRef);
    return true;
  }

  menu.dataset.menuInitialized = 'true';
  let userInfo = null;

  try {
    const response = await fetchImpl('/api/user-info', { credentials: 'include' });
    if (response.ok) {
      userInfo = await response.json();
    }
  } catch {
    userInfo = null;
  }

  applyMenuState(menu, userInfo);
  applyActiveMenuState(menu, locationRef);
  bindLogout(menu, { fetchImpl, locationRef });
  return true;
};

export const watchForMenu = ({
  documentRef = globalThis.document,
  fetchImpl = globalThis.fetch,
  locationRef = globalThis.location,
  MutationObserverImpl = globalThis.MutationObserver
} = {}) => {
  if (!documentRef) {
    return null;
  }

  const tryInitialize = () => initializeMenu({ documentRef, fetchImpl, locationRef });

  tryInitialize();

  if (!MutationObserverImpl || !documentRef.body) {
    return null;
  }

  const observer = new MutationObserverImpl(async () => {
    const initialized = await tryInitialize();
    if (initialized) {
      observer.disconnect();
    }
  });

  observer.observe(documentRef.body, { childList: true, subtree: true });
  return observer;
};

if (typeof window !== 'undefined' && typeof document !== 'undefined' && !globalThis.__REPORTGEN_MENU_DISABLE_AUTO_INIT__) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => watchForMenu());
  } else {
    watchForMenu();
  }
}
