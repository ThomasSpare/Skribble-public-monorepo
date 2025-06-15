-- backend/migrations/004_subscription_referrals.sql
-- Add subscription and referral columns to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive';
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_end_-- backend/migrations/003_subscription_referrals.sql
-- Add subscription and referral columns to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive';
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_rewards_earned INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"collaborations": true, "projects": true, "weekly": true, "marketing": false, "email": true, "push": true}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"profileVisibility": "public", "showEmail": false, "allowDirectMessages": true, "indexInSearch": true}';

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, expired
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  UNIQUE(referrer_id, referred_id)
);

-- Create subscription_analytics table for tracking
CREATE TABLE IF NOT EXISTS subscription_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- trial_started, subscription_created, payment_succeeded, etc.
  tier VARCHAR(20),
  amount_cents INTEGER,
  stripe_event_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create project_collaborators table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'collaborator', -- collaborator, viewer, editor
  permissions JSONB DEFAULT '{"canComment": true, "canEdit": false, "canDownload": false}',
  invited_at TIMESTAMP DEFAULT NOW(),
  joined_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, removed
  UNIQUE(project_id, user_id)
);

-- Create annotations table if it doesn't exist
CREATE TABLE IF NOT EXISTS annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp_start DECIMAL(10,3) NOT NULL, -- Start time in seconds
  timestamp_end DECIMAL(10,3), -- End time for range annotations
  annotation_type VARCHAR(20) NOT NULL DEFAULT 'comment', -- comment, voice_note, marker, issue
  content TEXT,
  voice_note_url VARCHAR(255), -- S3 URL for voice notes
  priority VARCHAR(10) DEFAULT 'normal', -- low, normal, high, critical
  status VARCHAR(20) DEFAULT 'open', -- open, resolved, dismissed
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_subscription_analytics_user ON subscription_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_analytics_event ON subscription_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user ON project_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_project ON annotations(project_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_timestamp ON annotations(timestamp_start);

-- Update existing users to have default subscription status
UPDATE users SET subscription_status = 'inactive' WHERE subscription_status IS NULL;

-- Update subscription_tier to handle trial variants
ALTER TABLE users ALTER COLUMN subscription_tier TYPE VARCHAR(50);

-- Set default notification and privacy settings for existing users
UPDATE users 
SET notification_settings = '{"collaborations": true, "projects": true, "weekly": true, "marketing": false, "email": true, "push": true}'::jsonb
WHERE notification_settings IS NULL;

UPDATE users 
SET privacy_settings = '{"profileVisibility": "public", "showEmail": false, "allowDirectMessages": true, "indexInSearch": true}'::jsonb
WHERE privacy_settings IS NULL;