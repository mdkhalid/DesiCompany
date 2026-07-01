-- Run this in PostgreSQL after updating DB_PASSWORD in .env
-- Copy the password from backendapi/.env DB_PASSWORD and paste below

ALTER USER desicompany WITH PASSWORD 'your-new-password-here';
