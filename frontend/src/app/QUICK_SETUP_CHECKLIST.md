# Quick Railway Analytics Setup Checklist

## Pre-Development (5 minutes)
- [ ] Copy `src/lib/database-pg.ts` from this project
- [ ] Copy `src/lib/database-fallback.ts` from this project  
- [ ] Copy `src/lib/analytics.ts` from this project
- [ ] Add dependencies to package.json:
  ```bash
  npm install pg sharp bcryptjs recharts @types/pg @types/bcryptjs
  ```

## API Routes Setup (10 minutes)
- [ ] Copy `src/app/api/analytics/route.ts`
- [ ] Copy `src/app/api/analytics/stats/route.ts`  
- [ ] Copy `src/app/api/auth/dashboard/route.ts`
- [ ] Copy `src/app/api/health/route.ts`
- [ ] **CRITICAL:** Verify all routes have `export const dynamic = 'force-dynamic'`

## Client-Side Setup (5 minutes)
- [ ] Copy `src/components/Analytics.tsx`
- [ ] Copy `src/components/DashboardLogin.tsx`
- [ ] Add `<Analytics />` to `src/app/layout.tsx`

## Dashboard Setup (10 minutes)
- [ ] Copy `src/app/dashboard/page.tsx`
- [ ] Generate password hash: `bcrypt.hashSync('your-password', 12)`
- [ ] Update hash in `src/app/api/auth/dashboard/route.ts`

## Railway Deployment (5 minutes)
1. **Add PostgreSQL FIRST:**
   - Railway Dashboard → New → Database → Add PostgreSQL
   - Wait for deployment (creates DATABASE_URL)

2. **Deploy App:**
   - Connect GitHub repo to Railway
   - Railway auto-detects Next.js and builds

## Testing & Verification (5 minutes)
- [ ] Visit `/api/health` → should show `"database": "connected"`
- [ ] Visit main site → check browser console for analytics logs
- [ ] Visit `/dashboard` → enter password → should load without errors
- [ ] Visit main site a few times → refresh dashboard → should show data

## If Something Goes Wrong

### Build Errors
- Missing `export const dynamic = 'force-dynamic'` in API routes
- Run `npm install` and commit updated `package-lock.json`

### No Analytics Data  
- Check Railway logs for database errors
- Verify DATABASE_URL exists in app environment variables
- Check browser console for analytics tracking logs

### Database Connection Issues
- Ensure PostgreSQL service is running in Railway
- Check DATABASE_URL format: `postgresql://user:pass@host:port/db`

## Total Setup Time: ~40 minutes

Save this checklist for your next Railway analytics implementation!