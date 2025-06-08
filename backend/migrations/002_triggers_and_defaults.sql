-- backend/migrations/002_triggers_and_defaults.sql
-- Add triggers and default data

-- Create updated_at trigger function (using DELIMITER to avoid $ issues)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS '
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
' LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_annotations_updated_at ON annotations;
CREATE TRIGGER update_annotations_updated_at 
    BEFORE UPDATE ON annotations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();