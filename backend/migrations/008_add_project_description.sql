-- Add description column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- Add index for searching descriptions if needed in the future
CREATE INDEX IF NOT EXISTS idx_projects_description ON projects USING gin(to_tsvector('english', description));