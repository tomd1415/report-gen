export const loadFragment = async ({
  documentRef = globalThis.document,
  fetchImpl = globalThis.fetch,
  selector,
  url
}) => {
  const target = documentRef?.querySelector(selector);
  if (!target || !fetchImpl) {
    return false;
  }
  if (target.dataset.layoutLoaded === 'true') {
    return true;
  }

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }

  target.innerHTML = await response.text();
  target.dataset.layoutLoaded = 'true';
  return true;
};

export const loadSharedLayout = ({
  documentRef = globalThis.document,
  fetchImpl = globalThis.fetch
} = {}) => Promise.all([
  loadFragment({ documentRef, fetchImpl, selector: '#header-placeholder', url: 'header.html' }),
  loadFragment({ documentRef, fetchImpl, selector: '#footer-placeholder', url: 'footer.html' })
]);

const loadOnReady = () => {
  loadSharedLayout().catch((error) => {
    console.error('Error loading shared page layout:', error);
  });
};

if (typeof window !== 'undefined' && typeof document !== 'undefined' && !globalThis.__REPORTGEN_LAYOUT_DISABLE_AUTO_INIT__) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadOnReady);
  } else {
    loadOnReady();
  }
}
