-- Reset migrations table to track only the new consolidated migration
-- Run this manually if you want to start fresh with the consolidated migration

DROP TABLE IF EXISTS applied_migrations;

CREATE TABLE applied_migrations (
    filename String,
    applied_at DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY filename;

-- Mark the consolidated migration as applied
INSERT INTO applied_migrations (filename) VALUES ('001_consolidated_final.sql'); 