# Analytics Widget for CodeDeck Electron App

## Overview
The Analytics widget displays website visitor analytics from Google Analytics 4 inside the CodeDeck Electron app. It shows users their website traffic, page views, traffic sources, and visitor behavior in a compact, clean interface.

**Scope:** This widget focuses on visitor tracking only - page views, traffic sources, and user engagement. It does NOT track ecommerce/revenue data.

## Architecture

### How It Works
1. **User creates project** from template in CodeDeck
2. **User deploys project** to production through CodeDeck
3. **CodeDeck injects GA4 tracking code** into deployed project with CodeDeck's GA4 measurement ID
4. **Tracking code sends data** to CodeDeck's GA4 property with custom dimension `project_id`
5. **Analytics Widget queries** CodeDeck's GA4 property, filtered by `project_id`
6. **User sees only their project's analytics** in the widget

This is similar to how Vercel/Netlify shows you analytics for your deployed projects.

## Current Implementation Status

### ✅ Completed
- **Full widget UI** with draggable interface (hotkey: A)
- **State persistence** (position, size, enabled state) saved to database per project
- **Mock data mode** - Works immediately without any configuration
- **Real-time active users display** with pulsing indicator
- **Overview stats** - Visitors, page views, average time on site
- **Visitor trend chart** - 7-day line chart using Recharts
- **Top pages breakdown** - Top 5 pages with view percentages
- **Traffic sources breakdown** - Google, Direct, Social, Referral with color coding
- **Device breakdown** - Desktop, Mobile, Tablet percentages
- **Time range selector** - Today / 7 Days / 30 Days
- **Refresh functionality** - Manual refresh button + auto-refresh every 5 minutes
- **IPC communication** - Full Electron backend/frontend integration
- **GA4 REST API integration** - Using GA4 Data API v1 directly (no SDK dependencies)
- **Service account authentication** - JWT-based OAuth2 token generation
- **Project ID filtering** - Filters GA4 data by `customUser:project_id` dimension

### 🚧 Pending (When Ready to Deploy)
- **GA4 service account setup** - Create service account in Google Cloud Console
- **GA4 property configuration** - Add custom dimension `project_id`
- **Environment variable configuration** - Add credentials and property ID
- **Deployment script** - Inject GA4 tracking code into deployed projects

## Data Source

### Google Analytics Data API v1 (REST)
- Uses GA4 Data API REST endpoints directly via `fetch`
- No external SDK dependencies (avoids ES module compatibility issues)
- Service account authentication with JWT tokens
- Automatic token refresh on expiration (401 responses)

### Authentication Method
**Service Account (CodeDeck's GA4):**
- CodeDeck uses its own GA4 property with service account credentials
- Service account JSON credentials stored in environment variable
- Queries filtered by `project_id` to show only relevant user's data
- User never needs to provide API credentials

**Files:**
- **Service:** `/electron/services/AnalyticsService.ts`
- **IPC Handlers:** `/electron/handlers/analyticsHandlers.ts`
- **Frontend Component:** `/src/components/AnalyticsWidget.tsx`
- **State Management:** `/src/store/layoutStore.ts`
- **Database:** Column `analyticsWidgetState` in projects table

## Project ID Filtering System

### How It Works

**Step 1: GA4 Tracking Code Injection (When Deploying)**
When CodeDeck deploys a user's project, inject this tracking code in the HTML:
```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  // IMPORTANT: Include project_id as custom dimension
  gtag('config', 'G-XXXXXXXXX', {
    'project_id': '{{ PROJECT_ID_FROM_DATABASE }}' // e.g., 'abc-123-def-456'
  });
</script>
```

**Step 2: GA4 Custom Dimension Setup**
In your GA4 property admin panel:
1. Go to **Admin → Data display → Custom definitions**
2. Click **Create custom dimension**
3. Set:
   - **Dimension name:** `project_id`
   - **Scope:** User
   - **User property:** `project_id`
4. Save

**Step 3: Widget Queries with Filter**
The AnalyticsService automatically adds this filter to all queries:
```typescript
dimensionFilter: {
  filter: {
    fieldName: 'customUser:project_id',
    stringFilter: {
      value: projectId, // From CodeDeck database
      matchType: 'EXACT'
    }
  }
}
```

Result: Only data for that specific project is returned.

## Setup Instructions

### Prerequisites
1. **Google Cloud Project** with Analytics API enabled
2. **GA4 Property** for CodeDeck
3. **Service Account** with Analytics Viewer role

### Step 1: Create Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create new one)
3. Navigate to **IAM & Admin → Service Accounts**
4. Click **Create Service Account**
5. Name: `codedeck-analytics-reader`
6. Click **Create and Continue**
7. Grant role: **Viewer** (for Analytics API)
8. Click **Done**
9. Click on the service account email
10. Go to **Keys** tab
11. Click **Add Key → Create new key**
12. Choose **JSON** format
13. Download the JSON file (keep it secure!)

### Step 2: Grant Analytics Access
1. Go to [Google Analytics](https://analytics.google.com)
2. Select your GA4 property
3. Go to **Admin → Property Access Management**
4. Click **Add users**
5. Enter the service account email (from Step 1)
6. Grant **Viewer** role
7. Click **Add**

### Step 3: Create Custom Dimension in GA4
1. In GA4, go to **Admin → Data display → Custom definitions**
2. Click **Create custom dimension**
3. Configure:
   - **Dimension name:** `project_id`
   - **Scope:** User
   - **User property:** `project_id`
4. Click **Save**
5. **Note:** It takes 24-48 hours for custom dimensions to start collecting data

### Step 4: Configure Environment Variables
Add these to your Electron app's environment (`.env` file or production environment):

```bash
# GA4 Service Account Credentials (entire JSON as string)
GA4_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"codedeck-analytics-reader@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'

# GA4 Property ID (format: properties/XXXXXXXXX)
GA4_PROPERTY_ID='properties/123456789'
```

**How to get Property ID:**
1. Go to GA4 Admin → Property Settings
2. Look for **Property ID** (numeric, like `123456789`)
3. Format it as: `properties/123456789`

### Step 5: Inject GA4 Tracking Code in Deployed Projects
When deploying a user's project, inject the tracking code in their HTML `<head>`:

```javascript
// In your deployment script
const ga4TrackingCode = `
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YOUR-MEASUREMENT-ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-YOUR-MEASUREMENT-ID', {
    'project_id': '${project.id}' // UUID from CodeDeck database
  });
</script>
`

// Insert before </head> tag in HTML
const htmlWithTracking = html.replace('</head>', `${ga4TrackingCode}</head>`)
```

**Where to get Measurement ID:**
1. GA4 Admin → Data Streams
2. Click on your web stream
3. Copy the **Measurement ID** (format: `G-XXXXXXXXX`)

## Widget Features

### Real-time Metrics
- **Active users now** - Real-time active users on the site (pulsing green indicator)

### Overview Stats (Time Range Dependent)
- **Visitors** - Total unique users
- **Page Views** - Total page views
- **Avg Time** - Average session duration (formatted as "Xm Ys")

### Visitor Trend Chart
- Line chart showing daily visitor counts
- X-axis: Dates (formatted as "Mon DD")
- Y-axis: Number of visitors
- Time range dependent (7 days of data points for "7D" mode)

### Top Pages
- Top 5 pages by view count
- Shows page path and percentage of total views

### Traffic Sources
- Distribution of traffic sources with color coding:
  - **Google** (Organic Search) - Blue `#4285F4`
  - **Direct** - Green `#34A853`
  - **Social** (Organic Social) - Yellow `#FBBC04`
  - **Referral** - Red `#EA4335`

### Device Breakdown
- Percentage split across device types:
  - **Desktop** - Purple `#8b5cf6`
  - **Mobile** - Pink `#ec4899`
  - **Tablet** - Cyan `#06b6d4`

### Time Range Selector
- **Today** - Data from today only
- **7D** - Last 7 days
- **30D** - Last 30 days

### Refresh Controls
- **Manual refresh button** - Click to refresh data immediately (shows spinning icon)
- **Auto-refresh** - Automatically refreshes every 5 minutes

### Settings Menu
- **Enter Your GA ID** - Placeholder for future user custom GA4 override (not yet implemented)
- **Visit Google Analytics** - Opens Google Analytics dashboard (only shown if user has set GA ID)

## Technical Details

### API Endpoints Used

**Real-time Report:**
```
POST https://analyticsdata.googleapis.com/v1beta/{property}:runRealtimeReport
```

**Historical Report:**
```
POST https://analyticsdata.googleapis.com/v1beta/{property}:runReport
```

### API Query Examples

**Get Active Users:**
```json
{
  "metrics": [{ "name": "activeUsers" }],
  "dimensionFilter": {
    "filter": {
      "fieldName": "customUser:project_id",
      "stringFilter": { "value": "project-uuid", "matchType": "EXACT" }
    }
  }
}
```

**Get Overview Stats:**
```json
{
  "dateRanges": [{ "startDate": "7daysAgo", "endDate": "today" }],
  "metrics": [
    { "name": "totalUsers" },
    { "name": "screenPageViews" },
    { "name": "averageSessionDuration" }
  ],
  "dimensionFilter": {
    "filter": {
      "fieldName": "customUser:project_id",
      "stringFilter": { "value": "project-uuid", "matchType": "EXACT" }
    }
  }
}
```

**Get Visitor Trend:**
```json
{
  "dateRanges": [{ "startDate": "7daysAgo", "endDate": "today" }],
  "dimensions": [{ "name": "date" }],
  "metrics": [{ "name": "totalUsers" }],
  "dimensionFilter": {
    "filter": {
      "fieldName": "customUser:project_id",
      "stringFilter": { "value": "project-uuid", "matchType": "EXACT" }
    }
  },
  "orderBys": [{ "dimension": { "dimensionName": "date" }, "desc": false }]
}
```

### Error Handling
- Graceful fallback to mock data if:
  - Service not initialized (credentials missing)
  - API requests fail
  - Token refresh fails
  - Network errors
- All errors logged to console for debugging
- User sees mock data without disruption

### Performance Optimizations
- **Batched API calls** - `getAllAnalytics()` fetches all data in parallel using `Promise.all()`
- **Token caching** - OAuth2 token cached for 1 hour (refreshed automatically on 401)
- **Debounced saves** - Widget state saves debounced by 500ms
- **Auto-refresh interval** - 5 minutes to avoid excessive API calls

### Security
- **Project ownership validation** - All IPC handlers validate user owns the project
- **Service account credentials** - Stored server-side only (never exposed to frontend)
- **OAuth2 tokens** - Generated server-side, never sent to renderer process
- **Scoped permissions** - Service account has read-only analytics access

## Testing

### Test with Mock Data
Widget works immediately without any configuration. Mock data includes:
- 127 active users
- Realistic visitor counts for different time ranges
- Sample top pages (/dashboard, /products, /pricing, /about, /contact)
- Traffic source distribution
- Device breakdown

### Test with Real Data
1. Complete setup steps above
2. Deploy a test project with GA4 tracking code
3. Generate some test traffic (visit the deployed site)
4. Wait a few hours for GA4 to process data
5. Open Analytics Widget in CodeDeck
6. Should see real data from your test project

**Note:** GA4 has processing delays:
- Real-time data: ~30 seconds
- Historical data: 24-48 hours (especially for custom dimensions)

## Troubleshooting

### Widget Shows Mock Data After Configuration
- Check console logs for error messages
- Verify `GA4_SERVICE_ACCOUNT_JSON` is valid JSON
- Verify `GA4_PROPERTY_ID` format is `properties/XXXXXXXXX`
- Ensure service account has Analytics Viewer role
- Check if custom dimension `project_id` exists in GA4

### No Data for Deployed Project
- Verify GA4 tracking code is injected in deployed HTML
- Verify `project_id` parameter matches database UUID exactly
- Check GA4 Realtime report to see if data is being received
- Custom dimensions take 24-48 hours to start collecting data
- Generate test traffic to the deployed site

### Authentication Errors
- Check service account JSON is complete and valid
- Verify private key format (`\n` characters preserved)
- Ensure service account has correct permissions in GA4
- Check Google Cloud Console for API errors

### API Rate Limits
- Widget auto-refreshes every 5 minutes (reasonable rate)
- GA4 Data API has generous quotas (10,000 requests/day for free)
- If hitting limits, increase auto-refresh interval in code

## Future Enhancements

### Phase 2 (Optional)
- **User custom GA4 override** - Allow users to use their own GA4 property
- **Export data** - Download analytics as CSV/PDF
- **Custom date ranges** - Pick specific start/end dates
- **Goals tracking** - Track conversions and events
- **A/B test results** - If user runs A/B tests
- **Alerts** - Notify user of traffic spikes/drops

### Performance Improvements
- **Incremental updates** - Only fetch new data, not full refresh
- **Local caching** - Cache data in IndexedDB for offline viewing
- **Background sync** - Update data in background without UI refresh

## Resources

- [GA4 Data API Documentation](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Custom Dimensions Guide](https://support.google.com/analytics/answer/10075209)
- [Service Account Setup](https://cloud.google.com/iam/docs/creating-managing-service-accounts)
- [GA4 REST API Reference](https://developers.google.com/analytics/devguides/reporting/data/v1/rest)
