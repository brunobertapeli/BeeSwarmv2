# Backend Deployment Checklist

## Files to Deploy to Render

### Updated Files:
- ✅ `src/server.js` - Added templates router
- ✅ `src/models/User.js` - User model
- ✅ `src/models/Template.js` - Template model with sourcePath
- ✅ `src/routes/users.js` - User API endpoints
- ✅ `src/routes/templates.js` - Templates API + download endpoint
- ✅ `templates/saas1-template.zip` - Template zip file (already in GitHub)

### Environment Variables on Render:
Make sure these are set in your Render dashboard:
- `MONGODB_URI` - Your MongoDB connection string
- `PORT` - 3000 (or let Render set it)
- `NODE_ENV` - production
- `ALLOWED_ORIGINS` - Your Electron app origins (comma-separated)

## Deployment Steps:

1. **Commit and push to GitHub:**
   ```bash
   cd /path/to/CodeDeck-Backend
   git add .
   git commit -m "Add template download endpoint and user APIs"
   git push origin main
   ```

2. **Verify on Render:**
   - Check that auto-deploy triggered
   - Or manually deploy from Render dashboard

3. **Test the endpoints:**
   ```bash
   # Test templates list
   curl https://codedeck-backend.onrender.com/api/v1/templates

   # Test download
   curl https://codedeck-backend.onrender.com/api/v1/templates/react_boilerplate/download -o test.zip
   ```

## Project Structure on Render:
```
/opt/render/project/src/
├── templates/
│   └── saas1-template.zip
├── src/
│   ├── config/
│   ├── models/
│   ├── routes/
│   └── server.js
└── package.json
```
