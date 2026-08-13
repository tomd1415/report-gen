import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// `src/config/env.js` falls back to the literal string 'dev-insecure-secret' when
// neither SESSION_SECRET nor SECRET_KEY is set, and only console.warn()s about
// it — in every environment, production included. A known session secret lets
// anyone forge a login cookie for a system holding pupil comments, and a warning
// on a boot log nobody reads is not a mitigation. It has been the top item on the
// project's own backlog (§6.5) since April.
//
// The owner also asked for an empty CORS_ORIGINS to be fatal in production. Their
// reasoning, recorded because it is the sharper half: an empty allow-list already
// blocks every cross-origin request, so it is fail-SAFE — but silently so. A
// misconfigured deploy presents as a broken frontend rather than a config error,
// and someone then debugs the wrong thing.
//
// These tests were written and seen to fail before the implementation existed.
//
// Note on the harness: config/env.js reads process.env at module load, so each
// case needs a fresh module registry. dotenv does not overwrite variables that
// are already defined — including ones defined as '' — so stubbing a variable
// empty genuinely simulates it being unset, even though this checkout has a real
// .env.

const loadConfig = async () => {
  vi.resetModules();
  return import('../src/config/env.js');
};

const productionEnv = ({ secret, cors = 'https://reportgen.example.com' } = {}) => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SESSION_SECRET', secret ?? '');
  vi.stubEnv('SECRET_KEY', '');
  vi.stubEnv('CORS_ORIGINS', cors);
};

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('the session secret must not be guessable in production', () => {
  it('refuses to load with no secret set', async () => {
    productionEnv({ secret: '' });
    await expect(loadConfig()).rejects.toThrow(/SESSION_SECRET/);
  });

  it("refuses to load with .env.example's placeholder", async () => {
    // The realistic failure: someone copies .env.example to .env, fills in the
    // database and API key because nothing works without them, and leaves this
    // one because everything works with it.
    productionEnv({ secret: 'change-me' });
    await expect(loadConfig()).rejects.toThrow(/SESSION_SECRET/);
  });

  it('refuses to load with the dev fallback set explicitly', async () => {
    productionEnv({ secret: 'dev-insecure-secret' });
    await expect(loadConfig()).rejects.toThrow(/SESSION_SECRET/);
  });

  it('loads with a real secret', async () => {
    // A control. Without it every assertion above would still pass if the module
    // simply refused to load under NODE_ENV=production.
    productionEnv({ secret: 'k7Qp2Zrf9WbN4xTvA6mLcE8sHy3Ud1Jo' });
    const { config } = await loadConfig();
    expect(config.env).toBe('production');
    expect(config.session.secret).toBe('k7Qp2Zrf9WbN4xTvA6mLcE8sHy3Ud1Jo');
  });

  it('still starts in development with no secret at all', async () => {
    // The second control, and the one that matters for contributors: a clean
    // checkout with no .env must still run the app and the tests.
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SESSION_SECRET', '');
    vi.stubEnv('SECRET_KEY', '');
    vi.stubEnv('CORS_ORIGINS', '');

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { config } = await loadConfig();

    expect(config.session.secret).toBe('dev-insecure-secret');
    // It must still SAY so — silently using a known secret in development is how
    // it ends up in production unnoticed.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('an empty CORS allow-list must not fail silently in production', () => {
  it('refuses to load when CORS_ORIGINS is empty', async () => {
    productionEnv({ secret: 'k7Qp2Zrf9WbN4xTvA6mLcE8sHy3Ud1Jo', cors: '' });
    await expect(loadConfig()).rejects.toThrow(/CORS_ORIGINS/);
  });

  it('loads when CORS_ORIGINS names an origin', async () => {
    productionEnv({ secret: 'k7Qp2Zrf9WbN4xTvA6mLcE8sHy3Ud1Jo', cors: 'https://a.example,https://b.example' });
    const { config } = await loadConfig();
    expect(config.cors.allowedOrigins).toEqual(['https://a.example', 'https://b.example']);
  });

  it('does not require CORS_ORIGINS in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SESSION_SECRET', '');
    vi.stubEnv('CORS_ORIGINS', '');

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { config } = await loadConfig();
    expect(config.cors.allowedOrigins).toEqual([]);
    warn.mockRestore();
  });
});
