-- Revert: rls-demo from pg

BEGIN;

DROP TRIGGER IF EXISTS pets_set_updated_at ON app.pets;
DROP FUNCTION IF EXISTS app.set_updated_at();

DROP POLICY IF EXISTS pets_delete ON app.pets;
DROP POLICY IF EXISTS pets_update ON app.pets;
DROP POLICY IF EXISTS pets_insert ON app.pets;
DROP POLICY IF EXISTS pets_select ON app.pets;

REVOKE ALL ON app.pets FROM authenticated;
REVOKE USAGE ON SCHEMA app FROM authenticated;

DROP TABLE IF EXISTS app.pets;
DROP SCHEMA IF EXISTS app;

COMMIT;
