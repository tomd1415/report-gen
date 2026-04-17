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
  if (!menu || menu.dataset.menuInitialized === 'true') {
    return Boolean(menu);
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
