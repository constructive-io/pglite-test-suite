import { vector } from '@electric-sql/pglite-pgvector';
import { getConnections, PgTestClient, seed } from 'pglite-test';

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  // pgvector is a WASM extension in PGlite: register the module at construction
  // (`extensions: { vector }`) and let the module's `CREATE EXTENSION vector`
  // provision it out-of-band. No native build, no server.
  ({ pg, db, teardown } = await getConnections(
    {
      pglite: {
        extensions: { vector },
        extensionSql: ['CREATE EXTENSION IF NOT EXISTS vector;'],
      },
    },
    [seed.pgpm(__dirname + '/..')]
  ));
}, 120000);

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await pg.beforeEach();
});

afterEach(async () => {
  await pg.afterEach();
});

describe('pgvector-demo: in-process vector search with PGlite', () => {
  it('installed the vector extension and created the table', async () => {
    const ext = await pg.one<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname = 'vector'"
    );
    expect(ext.extname).toBe('vector');

    const { rows } = await pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'search' AND table_name = 'documents'"
    );
    expect(rows[0].n).toBe(1);
  });

  it('ranks documents by cosine distance to a query vector', async () => {
    await pg.query(
      `INSERT INTO search.documents (content, embedding) VALUES
         ('apple',  '[1, 0, 0]'),
         ('banana', '[0, 1, 0]'),
         ('cherry', '[0, 0, 1]')`
    );

    // Query vector closest to 'apple' ([1,0,0]).
    const nearest = await pg.one<{ content: string }>(
      `SELECT content
         FROM search.documents
         ORDER BY embedding <=> $1
         LIMIT 1`,
      ['[0.9, 0.1, 0]']
    );

    expect(nearest.content).toBe('apple');
  });

  it('returns the full ranking in cosine-distance order', async () => {
    await pg.query(
      `INSERT INTO search.documents (content, embedding) VALUES
         ('apple',  '[1, 0, 0]'),
         ('banana', '[0, 1, 0]'),
         ('cherry', '[0, 0, 1]')`
    );

    const ranked = await pg.many<{ content: string }>(
      `SELECT content
         FROM search.documents
         ORDER BY embedding <=> $1`,
      ['[0.8, 0.2, 0]']
    );

    expect(ranked[0].content).toBe('apple');
    expect(ranked[1].content).toBe('banana');
    expect(ranked[2].content).toBe('cherry');
  });
});
