# Support System MongoDB Implementation Guide (Simplified)

## Overview
Simple MongoDB-based support system. Electron app reads/writes to MongoDB. Later, a separate webapp will also read/write to the same collections. No websockets or real-time complexity - just simple database operations.

## MongoDB Collections

### 1. `support_sessions` Collection
Stores active support chat conversations (when support is available).

**Schema:**
```javascript
{
  _id: ObjectId,
  userId: String,
  userName: String,
  userEmail: String,
  projectId: String,       // Optional
  messages: [{
    _id: ObjectId,
    userId: String,
    userName: String,
    userEmail: String,
    type: String,         // 'user' | 'support'
    content: String,
    timestamp: Date,
    read: Boolean         // For tracking unread messages
  }],
  status: String,         // 'active' | 'resolved'
  createdAt: Date,
  updatedAt: Date
}
```

### 2. `support_queue` Collection
Queue of users waiting for human support (when support is available).

**Schema:**
```javascript
{
  _id: ObjectId,
  userId: String,
  userName: String,
  userEmail: String,
  projectId: String,       // Optional
  lastMessage: String,     // Message that triggered /human
  status: String,          // 'waiting' | 'in-progress' | 'resolved'
  createdAt: Date,
  assignedTo: String,      // Optional - support agent ID
}
```

### 3. `support_status` Collection
**Single document with _id: "status"** - controls if human support is online.

**Schema:**
```javascript
{
  _id: "status",
  available: Boolean      // true = support online, false = offline
}
```

### 4. `support_messages` Collection
Offline messages (when support is unavailable).

**Schema:**
```javascript
{
  _id: ObjectId,
  userId: String,
  userName: String,
  userEmail: String,
  projectId: String,       // Optional
  subject: String,
  message: String,
  status: String,          // 'new' | 'read' | 'replied'
  createdAt: Date
}
```

### 5. `bug_reports` Collection
Bug reports from users.

**Schema:**
```javascript
{
  _id: ObjectId,
  userId: String,
  userName: String,
  userEmail: String,
  projectId: String,       // Optional
  bugType: String,         // 'ui' | 'functionality' | 'performance' | 'crash' | 'templates' | 'other'
  title: String,
  description: String,
  stepsToReproduce: String,  // Optional
  status: String,          // 'new' | 'investigating' | 'in-progress' | 'resolved' | 'wont-fix'
  createdAt: Date,
  updatedAt: Date
}
```

## Electron IPC Handlers (Node.js Backend)

### 1. `support:checkAvailability`
Check if human support is currently available.

**Logic:**
```javascript
ipcMain.handle('support:checkAvailability', async () => {
  try {
    const status = await db.collection('support_status').findOne({ _id: 'status' })
    return { success: true, available: status?.available || false }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

### 2. `support:saveMessage`
Save a message to the active support session.

**Logic:**
```javascript
ipcMain.handle('support:saveMessage', async (event, { userId, userName, userEmail, projectId, type, content }) => {
  try {
    const message = {
      _id: new ObjectId(),
      userId,
      userName,
      userEmail,
      type, // 'user' or 'support'
      content,
      timestamp: new Date(),
      read: false
    }

    // Find or create session
    const session = await db.collection('support_sessions').findOneAndUpdate(
      { userId, status: 'active' },
      {
        $setOnInsert: {
          userId,
          userName,
          userEmail,
          projectId,
          messages: [],
          status: 'active',
          createdAt: new Date()
        },
        $push: { messages: message },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, returnDocument: 'after' }
    )

    return { success: true, message }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

### 3. `support:getSession`
Get user's active support session.

**Logic:**
```javascript
ipcMain.handle('support:getSession', async (event, userId) => {
  try {
    const session = await db.collection('support_sessions').findOne({
      userId,
      status: 'active'
    })
    return { success: true, session }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

### 4. `support:addToQueue`
Add user to human support queue (when support is available).

**Logic:**
```javascript
ipcMain.handle('support:addToQueue', async (event, { userId, userName, userEmail, projectId, lastMessage }) => {
  try {
    const queueEntry = {
      userId,
      userName,
      userEmail,
      projectId,
      lastMessage,
      status: 'waiting',
      createdAt: new Date()
    }

    const result = await db.collection('support_queue').insertOne(queueEntry)
    queueEntry._id = result.insertedId

    return { success: true, queueEntry }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

### 5. `support:sendOfflineMessage`
Send offline message (when support is unavailable).

**Logic:**
```javascript
ipcMain.handle('support:sendOfflineMessage', async (event, { userId, userName, userEmail, projectId, subject, message }) => {
  try {
    const offlineMessage = {
      userId,
      userName,
      userEmail,
      projectId,
      subject,
      message,
      status: 'new',
      createdAt: new Date()
    }

    const result = await db.collection('support_messages').insertOne(offlineMessage)
    offlineMessage._id = result.insertedId

    return { success: true, offlineMessage }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

### 6. `support:submitBugReport`
Submit a bug report.

**Logic:**
```javascript
ipcMain.handle('support:submitBugReport', async (event, report) => {
  try {
    const bugReport = {
      ...report,
      status: 'new',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await db.collection('bug_reports').insertOne(bugReport)
    bugReport._id = result.insertedId

    return { success: true, bugReport }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

## User Flow

### When user types `/human`:
1. Frontend calls `support:checkAvailability()`
2. **If available = true:**
   - Call `support:addToQueue()` - adds user to queue
   - Show "🎉 You've been added to the support queue! A human agent will connect with you shortly.\n\nYou can minimize this chat - the help button will notify you when support responds."
   - Start polling for new messages every 5 seconds
3. **If available = false:**
   - Show offline message form (subject + message fields)
   - Call `support:sendOfflineMessage()` when user submits
   - Show "Thank you for your message! Our support team is currently offline, but we'll get back to you via email as soon as possible."

### Chat flow (when support is available):
1. User sends message → calls `support:saveMessage(type: 'user')`
2. Support agent (in webapp) sees message in MongoDB
3. Agent replies → webapp adds message with `type: 'support'` and `read: false`
4. User's app polls `support:getSession()` every 5 seconds to fetch new messages
5. When new unread messages detected and chat is closed:
   - Show badge with unread count on help button
   - Animate help button (bounce effect)
6. When user opens chat → reset unread count and stop animation

### Bug report flow:
1. User types `/bugreport` command
2. System shows bug report form with:
   - Bug Type selector (6 types: UI, Functionality, Performance, Crash, Templates, Other)
   - Title field (required)
   - Description field (required)
   - Steps to Reproduce field (optional)
3. Frontend calls `support:submitBugReport()`
4. Show confirmation: "Thank you for reporting this bug! Our team will review and fix it as soon as possible. We'll keep you updated via email."

## Implementation Checklist

- [x] Create all 5 MongoDB collections
- [x] Implement 6 IPC handlers in Electron main process
- [x] Test each handler individually
- [x] Verify data is being saved correctly in MongoDB
- [x] Test user flows (available/unavailable support)
- [x] Add polling in frontend to check for new support messages (every 5 seconds)
- [x] Implement notification system (badge + animation)
- [x] Add bug report form with 6 bug types

## Support Agent Webapp Requirements

When building the support agent webapp, it needs to:

### 1. Dashboard Features
- **Queue View**: Display all users in `support_queue` with status 'waiting', ordered by `createdAt`
- **Active Chats**: Show all `support_sessions` with status 'active'
- **Bug Reports**: List all `bug_reports` ordered by `createdAt`, filterable by status
- **Offline Messages**: Show all `support_messages` ordered by `createdAt`, filterable by status
- **Availability Toggle**: Update `support_status` collection to set `available: true/false`

### 2. Queue Management
```javascript
// Get waiting users
db.support_queue.find({ status: 'waiting' }).sort({ createdAt: 1 })

// Assign queue entry to agent
db.support_queue.updateOne(
  { _id: queueEntryId },
  {
    $set: {
      status: 'in-progress',
      assignedTo: agentId
    }
  }
)

// Create support session when agent accepts
db.support_sessions.insertOne({
  userId: queueEntry.userId,
  userName: queueEntry.userName,
  userEmail: queueEntry.userEmail,
  projectId: queueEntry.projectId,
  messages: [{
    _id: new ObjectId(),
    userId: queueEntry.userId,
    userName: queueEntry.userName,
    userEmail: queueEntry.userEmail,
    type: 'user',
    content: queueEntry.lastMessage,
    timestamp: queueEntry.createdAt,
    read: true
  }],
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date()
})
```

### 3. Sending Messages to Users
**IMPORTANT**: Messages must have `read: false` to trigger notifications in the Electron app.

```javascript
// Add support message to session
db.support_sessions.updateOne(
  { _id: sessionId },
  {
    $push: {
      messages: {
        _id: new ObjectId(),
        userId: agentId,
        userName: agentName,
        userEmail: agentEmail,
        type: 'support',              // MUST be 'support'
        content: messageContent,
        timestamp: new Date(),
        read: false                   // MUST be false for notification
      }
    },
    $set: { updatedAt: new Date() }
  }
)
```

### 4. Bug Report Management
```javascript
// Get all bug reports
db.bug_reports.find().sort({ createdAt: -1 })

// Filter by status
db.bug_reports.find({ status: 'new' }).sort({ createdAt: -1 })

// Update bug status
db.bug_reports.updateOne(
  { _id: bugReportId },
  {
    $set: {
      status: 'investigating',  // or 'in-progress', 'resolved', 'wont-fix'
      updatedAt: new Date()
    }
  }
)
```

### 5. Offline Message Management
```javascript
// Get all offline messages
db.support_messages.find().sort({ createdAt: -1 })

// Mark as read
db.support_messages.updateOne(
  { _id: messageId },
  { $set: { status: 'read' } }
)

// Mark as replied (after sending email)
db.support_messages.updateOne(
  { _id: messageId },
  { $set: { status: 'replied' } }
)
```

### 6. Real-time Updates (Optional)
For the webapp, you can use:
- **MongoDB Change Streams** to watch for new queue entries, messages, or bug reports
- **Polling** every 2-3 seconds for simpler implementation
- **WebSockets** for real-time updates between multiple agents

### 7. Testing Support Responses in Electron App
To manually test notifications, add a support message via MongoDB:

```javascript
// 1. Find user's active session
db.support_sessions.findOne({ userId: "USER_ID", status: "active" })

// 2. Add support response
db.support_sessions.updateOne(
  { userId: "USER_ID", status: "active" },
  {
    $push: {
      messages: {
        _id: new ObjectId(),
        userId: "support-agent-123",
        userName: "John (Support)",
        userEmail: "john@support.com",
        type: "support",
        content: "Hello! How can I help you today?",
        timestamp: new Date(),
        read: false  // This triggers notification
      }
    },
    $set: { updatedAt: new Date() }
  }
)

// 3. Within 5 seconds, the Electron app will:
//    - Show red badge with unread count
//    - Animate help button (bounce)
//    - Display message when user opens chat
```

## Notes
- No real-time features needed in Electron app - simple polling (5 seconds) works perfectly
- The webapp should handle all support agent operations
- All user info (userId, userName, userEmail) comes from auth system
- Keep it simple - just read/write to MongoDB
- Support messages MUST have `read: false` to trigger notifications
- Bug reports now include "templates" as a bug type option
