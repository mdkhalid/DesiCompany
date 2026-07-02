-- Run this in PostgreSQL after updating DB_PASSWORD in .env
-- Usage: psql -U postgres -d desicompany -f update-db-password.sql
-- Or set PGPASSWORD env var before running.
--
-- NOTE: DB_PASSWORD is set in backendapi/.env (which is gitignored).
--       NEVER hardcode passwords in committed files.

ALTER USER desicompany WITH PASSWORD :'DB_PASSWORD';
