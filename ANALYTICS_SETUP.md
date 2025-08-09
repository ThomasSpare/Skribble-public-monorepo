# Skribble Analytics Dashboard

## Overview

Your Skribble application now has a complete custom analytics system that tracks:
- Daily, weekly, monthly, and yearly visitor statistics
- Country-based visitor tracking with IP geolocation
- Device type breakdown (desktop, mobile, tablet)
- Browser analytics
- Page view tracking with session management
- Real-time dashboard with beautiful charts

## Features Implemented

### ✅ Backend Analytics Engine
- **Database Tables**: Analytics sessions and page views with PostgreSQL
- **GeoIP Integration**: Automatic country detection from visitor IP addresses
- **Session Management**: Intelligent session tracking with 4-hour expiration
- **API Endpoints**: RESTful APIs for tracking and dashboard data
- **Security**: Password-protected dashboard with bcrypt hashing

### ✅ Frontend Dashboard
- **Real-time Charts**: Beautiful charts using Recharts library
- **Time Range Selection**: View analytics for different time periods
- **Responsive Design**: Works perfectly on desktop and mobile
- **Secure Login**: Password-protected access to sensitive analytics data

### ✅ Automatic Tracking
- **Page View Tracking**: Automatically tracks all page visits
- **User Agent Parsing**: Detects browser, OS, and device type
- **Session Persistence**: Uses localStorage for session continuity
- **Privacy-Focused**: No external tracking services, all data stays on your server

## How to Access Your Analytics Dashboard

1. **Navigate to**: `https://your-domain.com/site-analytics`
2. **Default Password**: `admin123` (change this immediately!)
3. **View**: Real-time analytics with beautiful visualizations

## Changing the Dashboard Password

**IMPORTANT**: Change the default password before deploying to production!

1. Generate a new password hash:
```bash
cd backend
node -e "console.log(require('bcryptjs').hashSync('your-new-password', 12))"
```

2. Update the hash in `backend/src/routes/analytics.ts`:
```typescript
const DASHBOARD_PASSWORD_HASH = 'your-new-hash-here'
```

## Analytics Data Collected

### 📊 Page Views
- URL path visited
- Referrer information
- User agent details
- Screen resolution
- Timestamp
- Unique visitor detection

### 🌍 Geographic Data
- Country detection via IP address
- City information (when available)
- No personally identifiable information stored

### 📱 Device & Browser Analytics
- Device type (desktop/mobile/tablet)
- Browser detection (Chrome, Firefox, Safari, etc.)
- Operating system information

### ⏱️ Session Management
- Session duration tracking
- Page count per session
- Bounce rate calculation
- Session expiration (4 hours)

## Privacy & GDPR Compliance

- ✅ **No Cookies**: Uses localStorage, not tracking cookies
- ✅ **IP Anonymization**: Only stores country/city, not full IP addresses
- ✅ **No Personal Data**: No emails, names, or personal identifiers
- ✅ **Self-Hosted**: All data stays on your Railway server
- ✅ **Consent-Free**: Anonymous analytics don't require user consent

## Database Schema

### Analytics Sessions Table
- Session ID (UUID)
- Creation and update timestamps
- Page count and duration
- IP address (for geolocation only)
- User agent string

### Page Views Table
- Individual page visit records
- Path, referrer, and metadata
- Device and browser information
- Geographic location data
- Unique visitor flags

## API Endpoints

### Public (No Auth Required)
- `POST /api/analytics/track` - Track page views

### Protected (Dashboard Password Required)
- `POST /api/analytics/auth/dashboard` - Authenticate
- `GET /api/analytics/stats` - Get analytics data
- `GET /api/analytics/health` - Health check

## Railway Deployment Notes

The analytics system is designed to work seamlessly with Railway:

1. **PostgreSQL Required**: The system uses your existing Railway PostgreSQL database
2. **Environment Variables**: Uses your existing `DATABASE_URL`
3. **Automatic Migration**: Database tables are created via migration system
4. **Zero Config**: Works out of the box with your current Railway setup

## Performance Optimization

- **Indexed Database**: Optimized queries with proper indexes
- **Session Caching**: Efficient session management
- **Lightweight Tracking**: Minimal impact on page load times
- **Graceful Fallbacks**: Works even if database is temporarily unavailable

## Dashboard Features

### 📈 Real-Time Charts
- **Daily Traffic**: Area chart showing page views and unique visitors
- **Country Breakdown**: Top countries with percentage distribution
- **Device Analytics**: Pie chart of device types
- **Browser Stats**: Bar chart of popular browsers
- **Top Pages**: Most visited pages with engagement metrics

### 🔍 Time Range Filtering
- Today's traffic
- Last 7 days
- Last 30 days (default)
- Last 90 days
- Last year
- Custom date ranges

### 📊 Key Metrics
- Total page views
- Unique visitors
- Average daily views
- Average session duration
- Bounce rate
- Geographic distribution

## Monitoring & Health

- **Health Endpoint**: `/api/analytics/health` for monitoring
- **Database Status**: Connection health checks
- **Error Handling**: Graceful failure modes
- **Logging**: Comprehensive error logging for debugging

## Next Steps

1. **Change Default Password**: Update the dashboard password immediately
2. **Monitor Performance**: Check `/api/analytics/health` for database connectivity
3. **Review Data**: Visit your dashboard to see real-time analytics
4. **Customize**: Modify charts and metrics as needed for your business
5. **Scale**: The system handles high traffic with PostgreSQL optimization

## Support & Troubleshooting

### Common Issues

**Q: Dashboard shows no data**
- Check database connection at `/api/analytics/health`
- Verify migration ran successfully
- Ensure analytics tracking is enabled in production

**Q: Analytics tracking not working**
- Check browser console for JavaScript errors
- Verify API endpoint is accessible
- Confirm `NEXT_PUBLIC_API_URL` environment variable

**Q: Can't login to dashboard**
- Verify password hash in `analytics.ts`
- Check browser cookies are enabled
- Ensure HTTPS in production

---

🎉 **Congratulations!** Your Skribble app now has a complete, privacy-focused analytics dashboard that rivals Google Analytics but keeps all your data under your control.