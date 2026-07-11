import { getConnections, PgTestClient, seed } from 'pglite-test';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

const USER_1 = '550e8400-e29b-41d4-a716-446655440001';
const USER_2 = '550e8400-e29b-41d4-a716-446655440002';

beforeAll(async () => {
  // No Postgres server, no `createdb`, no Docker: getConnections() spins up an
  // in-process PGlite instance, deploys the pgpm module in this package, and
  // seeds the standard app roles — so setContext({ role: 'authenticated' })
  // works with no manual CREATE ROLE. (The cold-start timeout lives once in
  // jest.config.js, not inline here.)
  ({ pg, db, teardown } = await getConnections({}, [seed.pgpm(__dirname + '/..')]));
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await pg.beforeEach();
  await db.beforeEach();
});

afterEach(async () => {
  await db.afterEach();
  await pg.afterEach();
});

describe('hello-world: in-process PGlite RLS demo', () => {
  it('deployed the pgpm module into PGlite (schema + table exist)', async () => {
    const { rows } = await pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'pets'"
    );
    expect(rows[0].n).toBe(1);
  });

  it('lets an authenticated user create their own pet', async () => {
    db.setContext({ role: 'authenticated', 'jwt.claims.user_id': USER_1 });

    const pet = await db.one(
      `INSERT INTO app.pets (name, breed, user_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, breed, user_id`,
      ['Fido', 'Labrador', USER_1]
    );

    expect(pet.name).toBe('Fido');
    expect(pet.user_id).toBe(USER_1);
  });

  it('isolates writes between tests (previous insert was rolled back)', async () => {
    const { rows } = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM app.pets');
    expect(rows[0].n).toBe(0);
  });

  it('prevents a user from inserting a row they do not own (RLS WITH CHECK)', async () => {
    db.setContext({ role: 'authenticated', 'jwt.claims.user_id': USER_1 });

    await db.one(
      `INSERT INTO app.pets (name, breed, user_id) VALUES ($1, $2, $3) RETURNING id`,
      ['Ok', 'Beagle', USER_1]
    );

    await expect(
      db.one(`INSERT INTO app.pets (name, breed, user_id) VALUES ($1, $2, $3) RETURNING id`, [
        'Nope',
        'Poodle',
        USER_2,
      ])
    ).rejects.toThrow();
  });

  it('shows each user only their own rows in list queries', async () => {
    // Superuser seeds rows for two owners (pg bypasses RLS by not switching role).
    await pg.query(
      `INSERT INTO app.pets (name, breed, user_id)
       VALUES ('Mine', 'Labrador', $1), ('Theirs', 'Poodle', $2)`,
      [USER_1, USER_2]
    );

    db.setContext({ role: 'authenticated', 'jwt.claims.user_id': USER_1 });
    const mine = await db.many<{ name: string }>('SELECT name FROM app.pets ORDER BY name');
    expect(mine.map((r) => r.name)).toEqual(['Mine']);

    db.setContext({ role: 'authenticated', 'jwt.claims.user_id': USER_2 });
    const theirs = await db.many<{ name: string }>('SELECT name FROM app.pets ORDER BY name');
    expect(theirs.map((r) => r.name)).toEqual(['Theirs']);
  });
});
