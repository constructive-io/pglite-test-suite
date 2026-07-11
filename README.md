# PGlite Test Suite

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/pglite-test-suite/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/pglite-test-suite/actions/workflows/ci.yml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/pglite-test-suite/blob/main/LICENSE"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
</p>

A friendly playground for building and validating PostgreSQL modules — Row-Level Security, triggers, and pgvector similarity search — **entirely in-process, with no Postgres server**. It includes real-world examples, pgpm migrations, and a test suite you can run anywhere Node runs.

Built with [`pglite-test`](https://www.npmjs.com/package/pglite-test) — a drop-in [`pgsql-test`](https://www.npmjs.com/package/pgsql-test)-style `getConnections()` backed by an in-process [**PGlite**](https://pglite.dev) (WASM Postgres) instance instead of a server. No `createdb`, no `psql`, no Docker: one WASM Postgres session per suite, with the same isolated per-test rollbacks.

## Features

- 🚀 **Zero infrastructure** - No Postgres server, no Docker, no Supabase CLI. `pnpm install && pnpm test`.
- ⚡ **Instant, isolated test DBs** - Each suite gets a fresh in-process PGlite; per-test savepoint rollbacks.
- 🔐 **RLS policy testing** - Real role + JWT-claim context switching (`setContext`) on a single WASM session.
- 🧠 **pgvector** - Cosine-distance similarity search via a WASM extension, no native build.
- 🧩 **Modular pgpm packages** - Reusable database modules deployed via `seed.pgpm()`, same plans as a server.
- 🧪 **Jest** - Fast, ordinary Jest — the only requirement is `NODE_OPTIONS=--experimental-vm-modules`.

## Quick Start

```bash
# Install dependencies (that's the whole setup — no database to start)
pnpm install

# Run everything
pnpm test

# Or watch a single package
cd packages/hello-world
pnpm test:watch
```

## Repository Structure

This is a pgpm workspace combining `pnpm` and `pgpm` for modular Postgres packages:

- **`packages/hello-world`** - Self-contained RLS demo (a `pets` table whose rows are owned per JWT claim). Shows role/context switching and `WITH CHECK` enforcement on in-process PGlite.
- **`packages/pgvector`** - pgvector similarity search. Registers the `vector` WASM extension at construction and ranks documents by cosine distance.

It was scaffolded the same way as a normal pgpm project (`pgpm init workspace` + `pgpm init`), then wired to use [`pglite-test`](https://www.npmjs.com/package/pglite-test) in place of [`pgsql-test`](https://www.npmjs.com/package/pgsql-test) — sibling to [`supabase-test-suite`](https://github.com/constructive-io/supabase-test-suite) and [`drizzle-orm-test`](https://www.npmjs.com/package/drizzle-orm-test).

## How it works

`getConnections()` from `pglite-test` is a drop-in for `pgsql-test`:

```ts
import { getConnections, PgTestClient, seed } from 'pglite-test';

let pg: PgTestClient, db: PgTestClient, teardown: () => Promise<void>;

beforeAll(async () => {
  // Standard app roles (authenticated, anonymous, …) are seeded for you, so
  // setContext({ role: 'authenticated' }) works with no manual CREATE ROLE.
  ({ pg, db, teardown } = await getConnections(
    {},
    [seed.pgpm(__dirname + '/..')] // deploy this package's pgpm module in-process
  ));
});

afterAll(() => teardown());
beforeEach(async () => { await pg.beforeEach(); await db.beforeEach(); });
afterEach(async () => { await db.afterEach(); await pg.afterEach(); });
```

Under the hood, `pglite-test` composes the same seams the rest of the stack uses:
`@pgpmjs/pglite-adapter`'s `registerPglite()` points `pg-cache` at PGlite (so `seed.pgpm()` deploys into it), and `pgsql-client`'s client-factory seam routes the test client at the same in-process session. Because PGlite is a single session, transaction control is ref-counted so the standard two-client `beforeEach`/`afterEach` harness works unchanged.

> **Building a boilerplate from this repo?** See
> [`docs/pglite-vs-pgsql-test.md`](docs/pglite-vs-pgsql-test.md) — a full catalog of
> every deviation from a standard `pgsql-test` project (deps, `--experimental-vm-modules`,
> WASM cold-start timeouts, role creation, extension provisioning, services-free CI).

### Notes specific to PGlite

- **In-memory by default.** Persist with `getConnections({ pglite: { dataDir: './.pglite' } })`.
- **Roles.** PGlite starts as one superuser with no app roles; create any role used via `setContext({ role })` through `pglite.extensionSql`.
- **Extensions.** WASM extensions (e.g. pgvector) are registered at construction via `pglite.extensions` and installed with `CREATE EXTENSION` in `extensionSql` — pgpm's `cleanSql` strips `CREATE EXTENSION` from migrations, so they are provisioned out-of-band.

## Requirements

- Node.js 20+
- pnpm 10+

(No Postgres, no Docker, no Supabase CLI.)

## Credits

**🛠 Built by the [Constructive](https://constructive.io) team — creators of modular Postgres tooling for secure, composable backends. If you like our work, contribute on [GitHub](https://github.com/constructive-io).**

## Disclaimer

AS DESCRIBED IN THE LICENSES, THE SOFTWARE IS PROVIDED “AS IS”, AT YOUR OWN RISK, AND WITHOUT WARRANTIES OF ANY KIND.

No developer or entity involved in creating this software will be liable for any claims or damages whatsoever associated with your use, inability to use, or your interaction with other users of the code, including any direct, indirect, incidental, special, exemplary, punitive or consequential damages, or loss of profits, cryptocurrencies, tokens, or anything else of value.
