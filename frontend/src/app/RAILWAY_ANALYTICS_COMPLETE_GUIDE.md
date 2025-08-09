# Complete Railway Analytics Setup Guide

## Overview
This guide covers setting up a self-hosted analytics dashboard on Railway with Next.js 14, PostgreSQL, and complete privacy control. Based on successful implementation for studio-web-solutions.

## Prerequisites
- Next.js 14 project
- Railway account
- GitHub repository

## Step 1: Package Dependencies

Add these to your `package.json`:

```json
{
  "dependencies": {
    "pg": "^8.11.3",
    "sharp": "^0.32.6",
    "bcryptjs": "^3.0.2",
    "recharts": "^3.1.2"
  },
  "devDependencies": {
    "@types/pg": "^8.10.9",
    "@types/bcryptjs": "^2.4.6"
  }
}
```

**Critical:** Run `npm install` after adding dependencies to update `package-lock.json`!

## Step 2: Database Configuration

### PostgreSQL Connection (`src/lib/database-pg.ts`)

```typescript
import { Pool } from 'pg'

let pool: Pool | null = null

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })
} else {
  console.warn('DATABASE_URL not found. Analytics features will be disabled.')
}

export async function initializeDatabase() {
  if (!pool) throw new Error('Database not configured')
  
  const client = await pool.connect()
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_views (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        path TEXT NOT NULL,
        referrer TEXT,
        user_agent TEXT,
        ip_address TEXT,
        country TEXT,
        city TEXT,
        device_type TEXT,
        browser TEXT,
        os TEXT,
        screen_resolution TEXT,
        session_id TEXT NOT NULL,
        is_unique_visitor BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        page_count INTEGER DEFAULT 1,
        duration INTEGER DEFAULT 0,
        ip_address TEXT,
        user_agent TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_page_views_timestamp ON page_views(timestamp);
      CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
      CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
    `)
    
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  } finally {
    client.release()
  }
}

// Add all your database functions here...
```

### Fallback System (`src/lib/database-fallback.ts`)

```typescript
export const fallbackAnalytics = {
  summary: {
    totalPageViews: 0,
    totalUniqueVisitors: 0,
    avgDailyViews: 0
  },
  dailyStats: [],
  countryStats: [],
  topPages: [],
  browserStats: [],
  deviceStats: [],
  referrerStats: []
}

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL
}

export async function executeWithFallback<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    if (!isDatabaseConfigured()) {
      console.warn('Database not configured, using fallback data')
      return fallback
    }
    return await operation()
  } catch (error) {
    console.error('Database operation failed, using fallback:', error)
    return fallback
  }
}
```

## Step 3: API Routes

### Analytics Tracking API (`src/app/api/analytics/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'

// ⚠️ CRITICAL: This prevents build-time database calls
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path, referrer, sessionId, screenResolution } = body
    
    // If database not configured, return success (graceful fallback)
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ 
        success: true, 
        sessionId: sessionId || 'fallback' 
      })
    }
    
    // Initialize database on first request
    await executeWithFallback(() => initializeDatabase(), undefined)
    
    // Your analytics tracking logic here...
    
    return NextResponse.json({ success: true, sessionId })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to track analytics' }, { status: 500 })
  }
}
```

### Analytics Stats API (`src/app/api/analytics/stats/route.ts`)

```typescript
import { NextResponse } from 'next/server'

// ⚠️ CRITICAL: This prevents build-time database calls
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Return fallback if database not configured
    if (!isDatabaseConfigured()) {
      return NextResponse.json(fallbackAnalytics)
    }
    
    // Your stats gathering logic here...
  } catch (error) {
    console.error('Failed to get analytics stats:', error)
    return NextResponse.json({ error: 'Failed to get analytics stats' }, { status: 500 })
  }
}
```

## Step 4: Client-Side Tracking

### Analytics Component (`src/components/Analytics.tsx`)

```typescript
'use client'

import { useEffect } from 'react'

export default function Analytics({ path }: { path?: string }) {
  useEffect(() => {
    const trackPageView = async () => {
      try {
        const sessionId = localStorage.getItem('analytics_session') || 'new'
        const screenResolution = `${window.screen.width}x${window.screen.height}`
        
        const response = await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: path || window.location.pathname,
            referrer: document.referrer,
            sessionId,
            screenResolution,
          }),
        })
        
        const data = await response.json()
        
        if (data.success && data.sessionId) {
          localStorage.setItem('analytics_session', data.sessionId)
        }
      } catch (error) {
        console.error('Analytics tracking failed:', error)
      }
    }

    trackPageView()
  }, [path])

  return null
}
```

### Add to Layout (`src/app/layout.tsx`)

```typescript
import Analytics from '@/components/Analytics'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Analytics />
        {children}
      </body>
    </html>
  )
}
```

## Step 5: Railway Deployment

### 1. Add PostgreSQL Database FIRST
1. Go to Railway dashboard → Your project
2. Click "New" → "Database" → "Add PostgreSQL"
3. Wait for deployment (creates `DATABASE_URL` automatically)

### 2. Connect Database to App
1. Click your Next.js app service → "Variables" tab
2. Verify `DATABASE_URL` exists (should be automatic)
3. If missing: Copy from PostgreSQL service → Connect tab

### 3. Deploy Configuration

Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 10
  }
}
```

## Step 6: Dashboard with Authentication

### Password Protection (`src/app/api/auth/dashboard/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// Generate hash: bcrypt.hashSync('your-password', 12)
const DASHBOARD_PASSWORD_HASH = 'your-hashed-password-here'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    const isValid = await bcrypt.compare(password, DASHBOARD_PASSWORD_HASH)
    
    if (isValid) {
      const response = NextResponse.json({ success: true })
      response.cookies.set('dashboard_auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 // 24 hours
      })
      return response
    }
    
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  } catch (error) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
```

## Common Issues & Solutions

### Issue 1: Build-Time Database Errors
**Error:** `ENOTFOUND postgres.railway.internal` during build
**Solution:** Add `export const dynamic = 'force-dynamic'` to ALL API routes

### Issue 2: Package Lock Sync Error
**Error:** `npm ci` fails with missing dependencies
**Solution:** Run `npm install` locally, commit updated `package-lock.json`

### Issue 3: Database Not Connected
**Error:** `/api/health` shows `"database": "not_configured"`
**Solution:** Verify `DATABASE_URL` environment variable in Railway app settings

### Issue 4: Analytics Not Tracking
**Debugging Steps:**
1. Check browser console for tracking logs
2. Check Railway logs for API requests
3. Verify Analytics component is in layout
4. Test `/api/health` endpoint

### Issue 5: Dashboard Shows Empty Data
**Common Causes:**
- Build-time database calls (add `dynamic = 'force-dynamic'`)
- Missing null safety in dashboard components
- Database queries not working properly

## Health Check Endpoint

Create `/api/health` for monitoring:

```typescript
import { NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/database-fallback'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: isDatabaseConfigured() ? 'connected' : 'not_configured',
    environment: process.env.NODE_ENV || 'development'
  })
}
```

## Testing Checklist

### Pre-Deploy Testing
- [ ] `npm run build` succeeds locally
- [ ] No TypeScript errors
- [ ] Package-lock.json is committed

### Post-Deploy Testing  
- [ ] `/api/health` shows database connected
- [ ] Visit main site shows analytics logs in console
- [ ] Railway logs show successful analytics API calls
- [ ] Dashboard loads without errors (with password)
- [ ] Analytics data appears after visiting site

## Key Lessons Learned

1. **Always add PostgreSQL BEFORE deploying app**
2. **Use `dynamic = 'force-dynamic'` on ALL API routes**  
3. **Implement fallback systems for graceful degradation**
4. **Test build process locally before deploying**
5. **Add comprehensive error handling and logging**
6. **Update package-lock.json when adding dependencies**

## Quick Setup Script

For your next project, follow these steps in order:

```bash
# 1. Add dependencies
npm install pg sharp bcryptjs recharts @types/pg @types/bcryptjs

# 2. Copy database files from this project
# 3. Copy API routes with dynamic exports
# 4. Add Analytics component to layout
# 5. Create PostgreSQL on Railway
# 6. Deploy app
# 7. Test with /api/health endpoint
```

This guide captures everything we learned during the complex Railway setup process. Save this for your next analytics dashboard implementation!