-- Analytics Tables Migration
-- Creates tables for website analytics tracking

-- Sessions table for tracking user sessions
CREATE TABLE IF NOT EXISTS analytics_sessions (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    page_count INTEGER DEFAULT 1,
    duration INTEGER DEFAULT 0, -- in seconds
    ip_address TEXT,
    user_agent TEXT
);

-- Page views table for tracking individual page visits
CREATE TABLE IF NOT EXISTS analytics_page_views (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    path TEXT NOT NULL,
    referrer TEXT,
    user_agent TEXT,
    ip_address TEXT,
    country TEXT,
    city TEXT,
    device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
    browser TEXT,
    os TEXT,
    screen_resolution TEXT,
    session_id TEXT NOT NULL REFERENCES analytics_sessions(id),
    is_unique_visitor BOOLEAN DEFAULT FALSE
);

-- Daily aggregated stats for performance
CREATE TABLE IF NOT EXISTS analytics_daily_stats (
    date DATE PRIMARY KEY,
    total_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    avg_session_duration REAL DEFAULT 0,
    bounce_rate REAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_timestamp ON analytics_page_views(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_path ON analytics_page_views(path);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_country ON analytics_page_views(country);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_session ON analytics_page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_device ON analytics_page_views(device_type);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_unique ON analytics_page_views(is_unique_visitor);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_created ON analytics_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_ip ON analytics_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_stats_date ON analytics_daily_stats(date);

-- Trigger to update session updated_at timestamp
CREATE OR REPLACE FUNCTION update_analytics_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analytics_sessions_update_timestamp
    BEFORE UPDATE ON analytics_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_session_timestamp();

-- Trigger to update daily stats updated_at timestamp
CREATE TRIGGER analytics_daily_stats_update_timestamp
    BEFORE UPDATE ON analytics_daily_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_session_timestamp();

-- Function to get or create a session
CREATE OR REPLACE FUNCTION get_or_create_analytics_session(
    session_id TEXT,
    ip_addr TEXT,
    user_agent_str TEXT
) RETURNS TEXT AS $$
DECLARE
    existing_session_id TEXT;
BEGIN
    -- Try to find existing session
    SELECT id INTO existing_session_id 
    FROM analytics_sessions 
    WHERE id = session_id 
    AND created_at > CURRENT_TIMESTAMP - INTERVAL '4 hours'; -- Session expires after 4 hours
    
    IF existing_session_id IS NULL THEN
        -- Create new session
        existing_session_id := COALESCE(session_id, gen_random_uuid()::text);
        INSERT INTO analytics_sessions (id, ip_address, user_agent)
        VALUES (existing_session_id, ip_addr, user_agent_str)
        ON CONFLICT (id) DO UPDATE SET
            updated_at = CURRENT_TIMESTAMP,
            page_count = analytics_sessions.page_count + 1;
    ELSE
        -- Update existing session
        UPDATE analytics_sessions 
        SET 
            updated_at = CURRENT_TIMESTAMP,
            page_count = page_count + 1,
            duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))::INTEGER
        WHERE id = existing_session_id;
    END IF;
    
    RETURN existing_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if visitor is unique (first visit today)
CREATE OR REPLACE FUNCTION is_unique_visitor_today(
    ip_addr TEXT,
    user_agent_str TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    visit_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO visit_count
    FROM analytics_page_views
    WHERE ip_address = ip_addr
    AND user_agent = user_agent_str
    AND timestamp >= CURRENT_DATE;
    
    RETURN visit_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily stats (called by cron or manually)
CREATE OR REPLACE FUNCTION update_analytics_daily_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    daily_views INTEGER;
    daily_unique INTEGER;
    daily_sessions INTEGER;
    daily_avg_duration REAL;
    daily_bounce_rate REAL;
BEGIN
    -- Calculate daily metrics
    SELECT 
        COUNT(*),
        COUNT(DISTINCT CASE WHEN is_unique_visitor THEN ip_address || user_agent END),
        COUNT(DISTINCT session_id)
    INTO daily_views, daily_unique, daily_sessions
    FROM analytics_page_views
    WHERE timestamp::DATE = target_date;
    
    -- Calculate average session duration
    SELECT AVG(duration)::REAL INTO daily_avg_duration
    FROM analytics_sessions
    WHERE created_at::DATE = target_date;
    
    -- Calculate bounce rate (sessions with only 1 page view)
    SELECT 
        (COUNT(CASE WHEN page_count = 1 THEN 1 END)::REAL / NULLIF(COUNT(*), 0) * 100)::REAL
    INTO daily_bounce_rate
    FROM analytics_sessions
    WHERE created_at::DATE = target_date;
    
    -- Insert or update daily stats
    INSERT INTO analytics_daily_stats (
        date, total_views, unique_visitors, total_sessions, 
        avg_session_duration, bounce_rate
    )
    VALUES (
        target_date, 
        COALESCE(daily_views, 0), 
        COALESCE(daily_unique, 0), 
        COALESCE(daily_sessions, 0),
        COALESCE(daily_avg_duration, 0),
        COALESCE(daily_bounce_rate, 0)
    )
    ON CONFLICT (date) DO UPDATE SET
        total_views = EXCLUDED.total_views,
        unique_visitors = EXCLUDED.unique_visitors,
        total_sessions = EXCLUDED.total_sessions,
        avg_session_duration = EXCLUDED.avg_session_duration,
        bounce_rate = EXCLUDED.bounce_rate,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create initial daily stats for today
SELECT update_analytics_daily_stats();