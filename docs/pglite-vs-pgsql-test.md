# PGlite vs. a standard `pgsql-test` suite

This repo was scaffolded like a normal pgpm project (`pgpm init workspace` +
`pgpm init`) and then wired to test against **in-process PGlite** instead of a
Postgres server. This file catalogs **every deviation** from a standard
`pgsql-test` project, so the differences can be baked into a boilerplate
(`pglite/*` family, or a dedicated `pgpm-pglite-boilerplates`).

Each item notes whether it's **required** (the suite won't work without it) or a
**convenience/robustness** choice.

---

## 1. Dependencies (required)

Swap the test framework and add the PGlite runtime as dev deps:

| Standard `pgsql-test` | PGlite suite |
| --- | --- |
| `pgsql-test` | `pglite-test` |
| — | `@pgpmjs/pglite-adapter` |
| — | `@electric-sql/pglite` |
| — (only for pgvector) | `@electric-sql/pglite-pgvector` |

`@electric-sql/pglite` is a **peer dependency** of `pglite-test` /
`@pgpmjs/pglite-adapter`, so it must be present in the consuming project.
`@electric-sql/pglite-pgvector` is only needed for the vector extension.

Test import site changes from `from 'pgsql-test'` to `from 'pglite-test'`; the
`getConnections` / `PgTestClient` / `seed` API is otherwise identical.

## 2. Jest must run under `--experimental-vm-modules` (required)

PGlite loads a WASM module via dynamic ESM `import`, so Jest needs VM modules
enabled. Set it in every package's scripts:

```jsonc
"scripts": {
  "test": "NODE_OPTIONS=--experimental-vm-modules jest",
  "test:watch": "NODE_OPTIONS=--experimental-vm-modules jest --watch"
}
```

## 3. Generous timeout for WASM cold-start (required on CI)

The first `getConnections()` compiles/loads the PGlite WASM module. On a cold CI
runner this can exceed **Jest's default 5s hook timeout**, which makes
`beforeAll` fail and `teardown` come back `undefined` (the failure we hit — the
deploy logs actually land *after* the timeout). Fix it in **one place** —
`jest.config.js` — not with per-test inline timeouts:

```js
// jest.config.js
module.exports = {
  // ...
  testTimeout: 120000, // WASM cold-start room (covers slow extension loads)
};
```

Loading a WASM **extension** (e.g. pgvector) is meaningfully slower than the
bare instance, so vector suites especially need this. The pglite boilerplate
ships this in its generated `jest.config.js`, so test files carry no inline
`beforeAll(..., 120000)` timeouts.

## 4. Roles are seeded by default (with an escape hatch)

On a real server `pgsql-test` bootstraps app roles (`anonymous` /
`authenticated` / `administrator` / `authenticated_client`) via
`DbAdmin.createUserRole()` as part of `createdb`. PGlite has no `createdb` — the
instance *is* the database — so `pglite-test` runs the equivalent bootstrap for
you before seeding, using the same role generators (`generateCreateBaseRolesSQL`
/ `generateCreateClientRoleSQL`) and the same attributes (`NOLOGIN`,
`administrator` gets `BYPASSRLS`). So a bare `getConnections()` can switch into
an app role with no manual `CREATE ROLE`:

```ts
await getConnections({}, [seed.pgpm(__dirname + '/..')]);
// db.setContext({ role: 'authenticated', ... }) just works
```

Custom role *names* come from `db.roles` (a `RoleMapping`), exactly like
`pgsql-test`.

**Escape hatch:** to boot a lone superuser and manage your own roles/users, pass
`pglite: { roles: false }` and create them in `extensionSql` (real Postgres DDL,
verbatim from what you'd run on a server):

```ts
await getConnections({
  pglite: {
    roles: false,
    extensionSql: ['CREATE ROLE app_writer NOLOGIN;', 'CREATE ROLE app_user LOGIN;']
  }
});
```

## 5. Extensions are provisioned out-of-band (required for extensions)

pgpm's `cleanSql` strips `CREATE EXTENSION` from migrations, and PGlite
extensions are WASM modules that must be registered at construction. So an
extension like pgvector needs three things wired together:

1. the `.control` file lists it in `requires` (how pgpm tracks the dependency);
2. the WASM module is registered at construction: `pglite: { extensions: { vector } }`;
3. it's installed at bootstrap: `pglite: { extensionSql: ['CREATE EXTENSION IF NOT EXISTS vector;'] }`.

Because `seed.pgpm()` deploys the module's **entire** plan on every suite, any
suite that seeds a module containing a vector column must register the extension
— even a suite that only tests RLS. Put steps 2–3 in one shared `connect()`
helper the suites import, rather than repeating them per file.

```ts
import { vector } from '@electric-sql/pglite-pgvector';

await getConnections(
  {
    pglite: {
      extensions: { vector },
      extensionSql: ['CREATE EXTENSION IF NOT EXISTS vector;'],
    },
  },
  [seed.pgpm(__dirname + '/..')]
);
```

On a real server the same `CREATE EXTENSION vector` just installs the native
extension — no `extensions` registration needed.

## 6. Single-session transaction model (behavioral difference)

On a server, `pg` and `db` are two independent connections; PGlite is **one
in-process session** shared by both clients. `pglite-test` routes both through a
ref-counting coordinator (`SharedTxn`) so exactly one
`BEGIN`/`SAVEPOINT`/`ROLLBACK`/`COMMIT` runs per test. Consequences:

- The standard `beforeEach`/`afterEach` harness works **unchanged**, including
  per-test savepoint rollback and transaction-local `setContext`.
- `pg` and `db` **share** the session, so they see each other's uncommitted
  writes within a test (on a server they're isolated). Fine for the usual "seed
  as `pg`, assert as `db`" flow; only matters if a test deliberately relies on
  cross-connection isolation.
- `publish()` (commit-and-continue mid-test) is **not supported** under the
  shared-session coordinator.

## 7. In-memory by default (convenience)

`getConnections()` defaults to an **in-memory** PGlite (no `dataDir`). Persist
opt-in with `getConnections({ pglite: { dataDir: './.pglite' } })`.

## 8. CI drops all services (the headline win)

A server-backed suite needs a Postgres (or Supabase/Docker/MinIO) service, env
vars (`PGHOST`/`PGPORT`/...), `pgpm tune`, and `admin-users bootstrap`. The
PGlite CI needs **none of it** — the whole job is:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: pnpm/action-setup@v4
    with: { version: 10 }
  - uses: actions/setup-node@v4
    with: { node-version: '22', cache: 'pnpm' }
  - run: pnpm install --frozen-lockfile
  - run: cd ./packages/${{ matrix.package }} && pnpm test
```

No `services:` block, no service readiness wait, no global `pgpm` install, no
role bootstrap. This is the main reason a PGlite boilerplate is attractive.

## 9. `pgpm.json` needs no role mapping (simplification)

The server/supabase suite maps roles in `pgpm.json` (`db.roles`, `useLocksForRoles`).
The PGlite suite's `pgpm.json` is just the workspace manifest (`{"packages": ["packages/*"]}`);
the standard roles are seeded automatically (see §4), and custom role *names*
can still be passed per-suite via `db.roles`.

---

## What stays exactly the same

- Package layout: `pgpm.plan`, `*.control`, `Makefile`, `deploy/` `verify/`
  `revert/`, `sql/`.
- The migration SQL itself — the same `deploy`/`verify`/`revert` scripts run on a
  server via `pgsql-test` and in-process via `pglite-test`.
- `getConnections` / `PgTestClient` / `seed.pgpm()` API and the
  `beforeEach`/`afterEach` hook pattern.
- Root tooling: `pnpm-workspace.yaml`, `lerna.json`, `tsconfig.json`,
  `eslint.config.js`, `.prettierrc.json`.

## Boilerplate checklist (derived from the above)

- [ ] deps: `pglite-test`, `@pgpmjs/pglite-adapter`, `@electric-sql/pglite` (+ `@electric-sql/pglite-pgvector` for a vector variant)
- [ ] `test` scripts prefixed with `NODE_OPTIONS=--experimental-vm-modules`
- [ ] single `testTimeout: 120000` in `jest.config.js` (no inline `beforeAll` timeouts)
- [ ] standard app roles seeded by default (opt out with `pglite: { roles: false }`)
- [ ] extensions: `pglite.extensions` + `CREATE EXTENSION` in `extensionSql`, declared in `.control`, shared via one `connect()` helper
- [ ] services-free CI workflow
- [ ] minimal `pgpm.json` (no `db.roles`)
