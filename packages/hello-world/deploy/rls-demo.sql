-- Deploy: rls-demo to pg
-- made with <3 @ constructive.io

BEGIN;

-- A self-contained RLS demo that needs no external auth schema. Ownership is
-- keyed on a JWT claim GUC (`jwt.claims.user_id`), set per request via
-- `db.setContext({ role, 'jwt.claims.user_id' })` in the tests. This runs
-- identically on a Postgres server and on in-process PGlite.

CREATE SCHEMA app;

CREATE TABLE app.pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- owner of the pet; compared against the current JWT claim
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    breed TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pets_user_id ON app.pets (user_id);

ALTER TABLE app.pets ENABLE ROW LEVEL SECURITY;

-- A row is visible/mutable only by the authenticated user that owns it.
CREATE POLICY pets_select ON app.pets
    FOR SELECT USING (user_id = current_setting('jwt.claims.user_id', true));

CREATE POLICY pets_insert ON app.pets
    FOR INSERT WITH CHECK (user_id = current_setting('jwt.claims.user_id', true));

CREATE POLICY pets_update ON app.pets
    FOR UPDATE USING (user_id = current_setting('jwt.claims.user_id', true));

CREATE POLICY pets_delete ON app.pets
    FOR DELETE USING (user_id = current_setting('jwt.claims.user_id', true));

GRANT USAGE ON SCHEMA app TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.pets TO authenticated;

CREATE FUNCTION app.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pets_set_updated_at
    BEFORE UPDATE ON app.pets
    FOR EACH ROW
    EXECUTE FUNCTION app.set_updated_at();

COMMIT;
