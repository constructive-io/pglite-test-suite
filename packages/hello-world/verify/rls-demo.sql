-- Verify: rls-demo on pg

BEGIN;

SELECT 1 / count(*) FROM information_schema.schemata WHERE schema_name = 'app';

SELECT 1 / count(*) FROM information_schema.tables
WHERE table_schema = 'app' AND table_name = 'pets';

SELECT 1 / count(*) FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'app' AND c.relname = 'pets' AND c.relrowsecurity = true;

SELECT 1 / count(*) FROM pg_policies
WHERE schemaname = 'app' AND tablename = 'pets' AND policyname = 'pets_select';

SELECT 1 / count(*) FROM pg_policies
WHERE schemaname = 'app' AND tablename = 'pets' AND policyname = 'pets_insert';

SELECT 1 / count(*) FROM information_schema.triggers
WHERE trigger_schema = 'app' AND trigger_name = 'pets_set_updated_at';

ROLLBACK;
