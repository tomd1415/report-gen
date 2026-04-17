// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let loadFragment;
let loadSharedLayout;

beforeAll(async () => {
  globalThis.__REPORTGEN_LAYOUT_DISABLE_AUTO_INIT__ = true;
  ({ loadFragment, loadSharedLayout } = await import('../public/page-layout.js'));
});

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('shared page layout loader', () => {
  it('loads header and footer placeholders', async () => {
    document.body.innerHTML = `
      <div id="header-placeholder"></div>
      <main>Page</main>
      <div id="footer-placeholder"></div>
    `;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('<nav>Header</nav>') })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('<footer>Footer</footer>') });

    const result = await loadSharedLayout({ documentRef: document, fetchImpl });

    expect(result).toEqual([true, true]);
    expect(fetchImpl).toHaveBeenNthCalledWith(1, 'header.html');
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'footer.html');
    expect(document.querySelector('#header-placeholder').innerHTML).toBe('<nav>Header</nav>');
    expect(document.querySelector('#footer-placeholder').innerHTML).toBe('<footer>Footer</footer>');
  });

  it('does not fetch when a placeholder is already loaded', async () => {
    document.body.innerHTML = '<div id="header-placeholder" data-layout-loaded="true">Existing</div>';
    const fetchImpl = vi.fn();

    const loaded = await loadFragment({
      documentRef: document,
      fetchImpl,
      selector: '#header-placeholder',
      url: 'header.html'
    });

    expect(loaded).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('ignores missing placeholders', async () => {
    const fetchImpl = vi.fn();

    const loaded = await loadFragment({
      documentRef: document,
      fetchImpl,
      selector: '#missing',
      url: 'missing.html'
    });

    expect(loaded).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
