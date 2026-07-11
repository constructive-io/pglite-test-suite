# @pglite-suite/hello-world

A self-contained Row-Level Security demo, tested **in-process with PGlite** — no Postgres server.

An `app.pets` table where each row is owned by a user, enforced with RLS keyed on a JWT claim GUC (`jwt.claims.user_id`). The test uses `pglite-test`'s `getConnections()` to deploy the pgpm module into an in-process PGlite instance, then switches role/context with `db.setContext(...)` to prove:

- an authenticated user can only create/see/update/delete their own rows,
- `WITH CHECK` blocks inserting rows owned by someone else,
- per-test savepoint rollbacks isolate writes.

```bash
pnpm test
```

The same `deploy/` / `verify/` / `revert/` scripts run unchanged on a real Postgres server via `pgsql-test`.
