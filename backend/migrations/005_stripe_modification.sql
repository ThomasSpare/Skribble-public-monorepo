-- Migration: Add S3 storage fields to audio_files table
-- Run this to update your existing database schema

-- Add S3-specific columns to audio_files table
ALTER TABLE audio_files 
ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500),
ADD COLUMN IF NOT EXISTS s3_bucket VARCHAR(100),
ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'local';

-- Add index for faster S3 key lookups
CREATE INDEX IF NOT EXISTS idx_audio_files_s3_key ON audio_files(s3_key);
CREATE INDEX IF NOT EXISTS idx_audio_files_storage_type ON audio_files(storage_type);

-- Update existing records to mark them as local storage
UPDATE audio_files 
SET storage_type = 'local' 
WHERE storage_type IS NULL;

-- Add constraint to ensure S3 files have s3_key
-- ALTER TABLE audio_files 
-- ADD CONSTRAINT chk_s3_storage 
-- CHECK (
--   (storage_type = 'local') OR 
--   (storage_type = 's3' AND s3_key IS NOT NULL)
-- );

-- Optional: Add metadata column for additional S3 info
ALTER TABLE audio_files 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index on metadata for faster queries
CREATE INDEX IF NOT EXISTS idx_audio_files_metadata ON audio_files USING GIN(metadata);

-- Comments for documentation
COMMENT ON COLUMN audio_files.s3_key IS 'S3 object key for files stored in AWS S3';
COMMENT ON COLUMN audio_files.s3_bucket IS 'S3 bucket name (usually from env var)';
COMMENT ON COLUMN audio_files.storage_type IS 'Storage location: local or s3';
COMMENT ON COLUMN audio_files.metadata IS 'Additional metadata for S3 files (JSON)';

-- Show updated schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'audio_files' 
ORDER BY ordinal_position;