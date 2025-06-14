-- Fixed 004_version_control_update.sql
-- This migration adds version control to the existing audio_files table
-- Step-by-step approach to avoid column dependency issues

-- STEP 1: Add version control columns to audio_files table
DO $
BEGIN
    -- Add version_number column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'audio_files' AND column_name = 'version_number') THEN
        ALTER TABLE audio_files ADD COLUMN version_number INTEGER DEFAULT 1;
    END IF;
    
    -- Add version_notes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'audio_files' AND column_name = 'version_notes') THEN
        ALTER TABLE audio_files ADD COLUMN version_notes TEXT;
    END IF;
    
    -- Add is_current_version column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'audio_files' AND column_name = 'is_current_version') THEN
        ALTER TABLE audio_files ADD COLUMN is_current_version BOOLEAN DEFAULT true;
    END IF;
END $;

-- STEP 2: Update existing records to have proper version numbers
UPDATE audio_files 
SET version_number = 1, is_current_version = true 
WHERE version_number IS NULL;

-- STEP 3: Make version_number NOT NULL after setting defaults
ALTER TABLE audio_files 
  ALTER COLUMN version_number SET NOT NULL;

-- STEP 4: Add performance indexes for audio_files
CREATE INDEX IF NOT EXISTS idx_audio_files_project_version 
  ON audio_files(project_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_audio_files_current 
  ON audio_files(project_id, is_current_version) 
  WHERE is_current_version = true;

-- STEP 5: Drop version_history table if it exists incomplete and recreate it properly
DO $
BEGIN
    -- Check if version_history table exists and drop it if incomplete
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'version_history') THEN
        -- Check if all required columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'version_history' AND column_name = 'change_summary') OR
           NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'version_history' AND column_name = 'user_id') THEN
            DROP TABLE version_history CASCADE;
        END IF;
    END IF;
END $;

-- STEP 6: Create complete version_history table
CREATE TABLE IF NOT EXISTS version_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  audio_file_id UUID REFERENCES audio_files(id) ON DELETE CASCADE,
  previous_version_id UUID REFERENCES audio_files(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL,
  change_type VARCHAR(50) NOT NULL DEFAULT 'upload',
  change_summary TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- STEP 7: Add indexes for version_history (only after table is complete)
CREATE INDEX IF NOT EXISTS idx_version_history_project 
  ON version_history(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_version_history_user 
  ON version_history(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_version_history_audio_file 
  ON version_history(audio_file_id);

-- STEP 8: Insert initial version history entries for existing files
INSERT INTO version_history (project_id, audio_file_id, version_number, change_type, change_summary, user_id, created_at)
SELECT 
  af.project_id,
  af.id,
  COALESCE(af.version_number, 1),
  'upload',
  'Initial version',
  af.uploaded_by,
  COALESCE(af.uploaded_at, CURRENT_TIMESTAMP)
FROM audio_files af
WHERE NOT EXISTS (
  SELECT 1 FROM version_history vh 
  WHERE vh.audio_file_id = af.id
);

-- STEP 9: Ensure only one current version per project
WITH latest_versions AS (
  SELECT 
    project_id,
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id 
      ORDER BY version_number DESC, uploaded_at DESC NULLS LAST
    ) as rn
  FROM audio_files 
  WHERE is_active = true OR is_active IS NULL
)
UPDATE audio_files 
SET is_current_version = CASE 
  WHEN id IN (SELECT id FROM latest_versions WHERE rn = 1) THEN true 
  ELSE false 
END;

-- STEP 10: Final verification (can be uncommented for debugging)
-- SELECT 'Migration completed successfully' as status;