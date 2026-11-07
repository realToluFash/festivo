-- Runs once, on an empty data directory only.
--
-- Extensions live here rather than in a Doctrine migration because they need
-- superuser, and the application's database user is not one.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
