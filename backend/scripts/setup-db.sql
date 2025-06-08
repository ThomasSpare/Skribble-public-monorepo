-- Create development database
CREATE DATABASE skribble_dev;
CREATE USER skribble_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE skribble_dev TO skribble_user;

-- Create test database
CREATE DATABASE skribble_test;
GRANT ALL PRIVILEGES ON DATABASE skribble_test TO skribble_user;

-- Create production database (run separately on production server)
-- CREATE DATABASE skribble_prod;
-- CREATE USER skribble_prod_user WITH PASSWORD 'very_secure_production_password';
-- GRANT ALL PRIVILEGES ON DATABASE skribble_prod TO skribble_prod_user;

-- Enable UUID extension
\c skribble_dev;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c skribble_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";