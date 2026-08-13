# Which admin route namespace is canonical? — decided 2026-08-13

**Decision: the flat family (`/api/subjects`, `/api/year-groups`, `/api/users`,
`/api/export-database`, `/api/backup-database`) is canonical. The parallel
`/api/admin/*` CRUD family is to be retired.**

The owner delegated this decision ("please check and you make the decision"), so
this document is the evidence it was made on rather than a preference.

## What actually exists

Enumerated from the running router, not from memory:

| name-keyed `/api/admin/*` | flat |
|---|---|
| `POST /api/admin/subject` | `POST /api/subjects` |
| `DELETE /api/admin/subject/:name` | `DELETE /api/subjects/:id` |
| `POST /api/admin/year-group` | `POST /api/year-groups` |
| `DELETE /api/admin/year-group/:name` | `DELETE /api/year-groups/:id` |
| `POST /api/admin/user` | `POST /api/users` |
| `DELETE /api/admin/user/:username` | `DELETE /api/users/:username` |
| `PUT /api/admin/user/:username/password` | *(no equivalent)* |
| `GET /api/admin/export` | `GET /api/export-database` |
| `POST /api/admin/backup` | `POST /api/backup-database` |

The flat family additionally has the `GET` list endpoints and `PUT` updates, which
the `/api/admin/*` family never had.

**`/api/admin/login` is not part of this.** It is authentication, not CRUD, has no
counterpart, and stays exactly where it is.

## The evidence

**1. Eight of the nine `/api/admin/*` routes are called by nothing.** Grepping
every page and browser module for each endpoint:

- `/api/admin/subject`, `/api/admin/year-group`, `/api/admin/export`,
  `/api/admin/backup` — **not referenced by any page**.
- `/api/admin/user` — referenced once, and only for
  `PUT /api/admin/user/:username/password` (`adminpage.html:407`).
- The flat family is used by **seven** pages plus `report-page.js`.

**2. Test coverage follows usage.** `/api/subjects`, `/api/year-groups` and
`/api/users` are exercised by the suite; `/api/users` by four files. Of the
name-keyed family only `/api/admin/user` appears, and that is the password route.
`/api/admin/export` and `/api/admin/backup` have no tests at all.

**3. The pairs are genuine duplicates.** `DELETE /api/admin/subject/:name` and
`DELETE /api/subjects/:id` differ only in the lookup — `findOne({ where: { name } })`
against `findByPk(id)` — then both `destroy()` and return 204, with identical error
handling. Nothing is lost by retiring one.

**4. Name-keyed lookup is the worse of the two**, independently of usage. A name
in a path breaks on a rename, needs URL-encoding (`Design & Technology`), and puts
the value into access logs, referrers and browser history. An id does not.

## The correction this turned up

The item framed this as *name-keyed* versus *id-keyed*. **That is not the split.**
`DELETE /api/users/:username` sits in the flat family and is keyed by username —
so the flat family is mixed, and adopting it does not by itself remove name-keyed
lookup. Worth knowing before someone "finishes the job" and is surprised.

## Migration, in the order it has to happen

Not started: consolidating needs a frontend change, and the item said the call was
needed before any work, not after.

1. **Add `PUT /api/users/:username/password`** as the flat equivalent, keeping
   `PUT /api/admin/user/:username/password` working. Additive, no client change.
2. **Point `adminpage.html:407` at the new route.** This is the only frontend edit
   the whole migration needs.
3. **Add a route-existence assertion** so the retired paths cannot come back —
   `route-auth-matrix.test.js` already enumerates the router, so this is a list to
   compare against, not new machinery.
4. **Remove the eight unused `/api/admin/*` CRUD routes**, then the ninth once
   step 2 has shipped and been exercised.
5. **Consider `DELETE /api/users/:username` → `/api/users/:id`** separately. It is
   the remaining name-keyed route and it is *used*, so it carries real migration
   cost for a smaller benefit. A separate decision, not a tidy-up.

**One caution.** "Called by no page in this repo" is not "called by nothing" — a
bookmark, a script, or a cached admin page can still hit a route. The routes are
admin-guarded so the risk is small, but step 4 should land after step 2 has been
in use for a while, and a log line on the retired routes before deletion would
turn the assumption into a measurement. That is cheap and worth doing.
