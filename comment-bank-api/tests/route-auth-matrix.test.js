import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { registerRoutes } from '../src/routes/index.js';

// Authentication in this app is applied by a block of `app.use(<prefix>, ...)`
// guards near the top of registerRoutes, separately from the route definitions
// themselves. That is two lists that have to agree with nothing checking that
// they do — a route added later simply does not appear in the guard block, and
// nothing goes red. This file is that check.
//
// The failure it catches is quiet rather than loud: an unguarded handler reads
// `req.session.user.id` and throws, which Express turns into a 500. Nothing
// crashes at boot, no test fails, and the endpoint looks like it is merely
// erroring rather than unprotected.

/**
 * Routes that are unauthenticated *by design*. Everything reachable here is
 * either public by necessity (login, register) or deliberately anonymous
 * (health, version).
 */
const INTENTIONALLY_PUBLIC = new Set([
  'GET /api/health',
  'GET /api/version',
  'GET /api/authenticated', // reports whether a session exists; must answer when it does not
  'POST /api/login',
  'POST /api/logout',
  'POST /api/register',
  'POST /api/admin/login'
]);

/**
 * Routes that are unguarded *by mistake* and answer 500 instead of 401.
 *
 * This is a list of outstanding BUGS, not approved exceptions — the same
 * convention as KNOWN_OFF_ORIGIN_VIOLATIONS in tests/e2e/ui-smoke.spec.js. The
 * test below asserts the list is EXACT, so:
 *   - fixing a route without deleting its entry here fails, and
 *   - adding a new unguarded route fails.
 *
 * Fix: add `app.use('/api/categories', isAuthenticated);` to the guard block in
 * src/routes/index.js (~line 465), then empty this list. Note that
 * `/api/categories-comments` needs its own entry regardless — an
 * `app.use('/api/categories')` prefix does not match it.
 *
 * See docs/PROJECT_STATE.md §6.9.
 */
const KNOWN_UNGUARDED = [
  'POST /api/categories',
  'GET /api/categories/:id',
  'PUT /api/categories/:id',
  'DELETE /api/categories/:id'
];

/** Models/OpenAI that scream if an unauthenticated request ever reaches them. */
const createTripwires = () => {
  const reached = [];
  const explode = (what) => async () => {
    reached.push(what);
    throw new Error(`unauthenticated request reached ${what}`);
  };
  const models = new Proxy({}, {
    get: (_target, model) => new Proxy({}, {
      get: (_t, method) => explode(`${String(model)}.${String(method)}`)
    })
  });
  const openai = { responses: { parse: explode('openai.responses.parse') } };
  return { models, openai, reached };
};

const createLoggedOutApp = ({ models, openai }) => {
  const app = express();
  app.use(express.json());
  // A real logged-out request: express-session always attaches req.session,
  // it just has no `user` on it. Omitting req.session entirely would be a
  // different (and easier) failure than the one production sees.
  app.use((req, res, next) => {
    req.session = {};
    next();
  });
  registerRoutes(app, { models, openai });
  return app;
};

/** Enumerate every method+path actually registered on the Express 5 router. */
const listRoutes = (app) => {
  const routes = [];
  for (const layer of app.router.stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) {
      routes.push({ method: method.toUpperCase(), path: layer.route.path });
    }
  }
  return routes;
};

const label = ({ method, path }) => `${method} ${path}`;
// ':id' etc. must become something concrete; the value never matters because a
// guarded route rejects before looking at it.
const concretePath = (path) => path.replace(/:[A-Za-z0-9_]+/g, '1');

describe('route auth matrix', () => {
  it('answers 401 or 403 to every logged-out request except the known-unguarded ones', async () => {
    const { models, openai, reached } = createTripwires();
    const app = createLoggedOutApp({ models, openai });

    const routes = listRoutes(app);
    // Guards against this whole test silently passing because the router was
    // empty or the enumeration broke.
    expect(routes.length).toBeGreaterThan(50);

    const unprotected = [];
    for (const route of routes) {
      if (INTENTIONALLY_PUBLIC.has(label(route))) continue;

      const response = await request(app)[route.method.toLowerCase()](concretePath(route.path)).send({});
      if (response.status !== 401 && response.status !== 403) {
        unprotected.push(`${label(route)} -> ${response.status}`);
      }
    }

    // No unauthenticated request may reach the database or OpenAI, whether or
    // not it was rejected with the right status code.
    expect(reached).toEqual([]);

    expect(unprotected.sort()).toEqual(
      KNOWN_UNGUARDED.map((entry) => `${entry} -> 500`).sort()
    );
  });

  it('keeps KNOWN_UNGUARDED honest: every entry names a route that still exists', () => {
    const { models, openai } = createTripwires();
    const routes = listRoutes(createLoggedOutApp({ models, openai })).map(label);

    for (const entry of KNOWN_UNGUARDED) {
      // A stale entry would let a genuinely unguarded route hide behind a name
      // that no longer resolves to anything.
      expect(routes).toContain(entry);
    }
  });

  it('lists no route as both intentionally public and known-unguarded', () => {
    const overlap = KNOWN_UNGUARDED.filter((entry) => INTENTIONALLY_PUBLIC.has(entry));
    expect(overlap).toEqual([]);
  });

  // The two checks below close a hole found on 2026-08-12 by asking the question
  // in docs/TESTING.md rule 6 — *what would satisfy this gate without satisfying
  // the thing it stands for?*
  //
  // Answer: INTENTIONALLY_PUBLIC. The main test `continue`s past those routes
  // before it sends anything, so an entry there is not a documented exception,
  // it is a route that is never tested at all. KNOWN_UNGUARDED is asserted exact
  // and checked for staleness; this list had neither. Adding
  // 'GET /api/users' to it would have turned a real hole green, and moving a
  // route out of the app would have left a stale entry silently covering for
  // whatever took its place.

  it('keeps INTENTIONALLY_PUBLIC honest: every entry names a route that still exists', () => {
    const { models, openai } = createTripwires();
    const routes = listRoutes(createLoggedOutApp({ models, openai })).map(label);

    for (const entry of INTENTIONALLY_PUBLIC) {
      expect(routes).toContain(entry);
    }
  });

  it('proves each INTENTIONALLY_PUBLIC route is genuinely unguarded, not just skipped', async () => {
    const { models, openai } = createTripwires();
    const app = createLoggedOutApp({ models, openai });

    // The guards in src/middleware/auth.js answer with these exact bodies, which
    // is what distinguishes "blocked before the handler ran" from "the handler
    // ran and chose this status". GET /api/authenticated is the case that makes
    // the distinction necessary: it legitimately answers 401 with
    // { authenticated: false } when there is no session, so a status check alone
    // would either fail it or have to carve it out by name.
    const blockedByGuard = (response) => (
      (response.status === 401 && response.body?.message === 'Unauthorized')
      || (response.status === 403 && response.body?.message === 'Forbidden')
    );

    const entries = [...INTENTIONALLY_PUBLIC];
    expect(entries.length).toBeGreaterThan(0);

    const actuallyGuarded = [];
    for (const entry of entries) {
      const [method, path] = entry.split(' ');
      const response = await request(app)[method.toLowerCase()](concretePath(path)).send({});
      if (blockedByGuard(response)) {
        actuallyGuarded.push(`${entry} -> ${response.status} ${response.body?.message}`);
      }
    }

    // A guarded route listed here would be a hole hidden by the skip list.
    expect(actuallyGuarded).toEqual([]);
  });
});
