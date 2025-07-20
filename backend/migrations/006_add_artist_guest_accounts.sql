-- Simple and Safe Guest Account Migration
-- File: 006_add_artist_guest_accounts.sql

-- Step 1: Add guest account tracking columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_invited_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_project_id UUID REFERENCES projects(id);

-- Step 2: Add subscription_status column with default
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR DEFAULT 'active';

-- Step 3: Update all NULL subscription_status values to 'active'
UPDATE users SET subscription_status = 'active' WHERE subscription_status IS NULL;

-- Step 4: Clean up any problematic subscription_status values
UPDATE users SET subscription_status = 'active' WHERE subscription_status = '';
UPDATE users SET subscription_status = 'active' WHERE subscription_status LIKE 'trial%';
UPDATE users SET subscription_status = 'pending' WHERE subscription_status LIKE 'incomplete%';
UPDATE users SET subscription_status = 'pending' WHERE subscription_status LIKE 'past_due%';
UPDATE users SET subscription_status = 'cancelled' WHERE subscription_status LIKE 'cancel%';
UPDATE users SET subscription_status = 'cancelled' WHERE subscription_status LIKE 'unpaid%';
UPDATE users SET subscription_status = 'cancelled' WHERE subscription_status LIKE 'suspend%';

-- Step 5: Set any remaining invalid values to 'active'
UPDATE users 
SET subscription_status = 'active' 
WHERE subscription_status NOT IN ('active', 'pending', 'expired', 'cancelled');

-- Step 6: Make subscription_status NOT NULL
ALTER TABLE users ALTER COLUMN subscription_status SET NOT NULL;

-- Step 7: Clean up subscription_tier values
UPDATE users 
SET subscription_tier = 'free' 
WHERE subscription_tier NOT IN ('free', 'indie', 'producer', 'studio', 'artist_guest');

-- Step 8: Drop existing constraints (ignore errors if they don't exist)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_status_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_guest_account_expiry;

-- Step 9: Add the constraints
ALTER TABLE users ADD CONSTRAINT users_subscription_status_check 
    CHECK (subscription_status IN ('active', 'pending', 'expired', 'cancelled'));

ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check 
    CHECK (subscription_tier IN ('free', 'indie', 'producer', 'studio', 'artist_guest'));

ALTER TABLE users ADD CONSTRAINT check_guest_account_expiry 
    CHECK (
        (subscription_tier = 'artist_guest' AND guest_expires_at IS NOT NULL) OR
        (subscription_tier != 'artist_guest' AND guest_expires_at IS NULL)
    );

-- Step 10: Add index for guest accounts
CREATE INDEX IF NOT EXISTS idx_users_guest_expires_at 
    ON users(guest_expires_at) 
    WHERE guest_expires_at IS NOT NULL;

-- Step 11: Update project invites table
ALTER TABLE project_invites ADD COLUMN IF NOT EXISTS creates_guest_account BOOLEAN DEFAULT FALSE;
ALTER TABLE project_invites ADD COLUMN IF NOT EXISTS guest_user_id UUID REFERENCES users(id);

-- Step 12: Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_guest_accounts()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
BEGIN
    UPDATE users 
    SET subscription_status = 'expired'
    WHERE subscription_tier = 'artist_guest' 
      AND guest_expires_at < NOW()
      AND subscription_status = 'active';
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Step 13: Add comments
COMMENT ON COLUMN users.guest_expires_at IS 'Expiration date for guest accounts (30 days from creation)';
COMMENT ON COLUMN users.guest_invited_by IS 'User ID who invited this guest (for tracking)';
COMMENT ON COLUMN users.guest_project_id IS 'Original project this guest was invited to';
COMMENT ON COLUMN users.subscription_status IS 'Current status of user subscription';
COMMENT ON COLUMN project_invites.creates_guest_account IS 'Whether this invite allows guest account creation';
COMMENT ON COLUMN project_invites.guest_user_id IS 'Guest user created from this invite (if any)';

-- Step 14: Create view for active guest accounts
CREATE OR REPLACE VIEW active_guest_accounts AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.guest_expires_at,
    u.guest_invited_by,
    u.guest_project_id,
    u.created_at,
    u.subscription_status,
    EXTRACT(DAY FROM (u.guest_expires_at - NOW())) as days_remaining,
    CASE 
        WHEN EXTRACT(DAY FROM (u.guest_expires_at - NOW())) <= 1 THEN 'critical'
        WHEN EXTRACT(DAY FROM (u.guest_expires_at - NOW())) <= 3 THEN 'high'
        WHEN EXTRACT(DAY FROM (u.guest_expires_at - NOW())) <= 7 THEN 'medium'
        ELSE 'low'
    END as urgency_level,
    inviter.username as invited_by_username,
    p.title as project_title
FROM users u
LEFT JOIN users inviter ON u.guest_invited_by = inviter.id
LEFT JOIN projects p ON u.guest_project_id = p.id
WHERE u.subscription_tier = 'artist_guest'
  AND u.subscription_status = 'active'
  AND u.guest_expires_at > NOW()
ORDER BY u.guest_expires_at ASC;