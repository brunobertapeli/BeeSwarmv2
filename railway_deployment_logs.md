🚀 [DEPLOY] Starting deployment for project proj_1764711520745_4a9onf7kh to railway
📤 [DEPLOY] Progress: Starting deployment to railway...
📤 [DEPLOY] Progress: Found 7 environment variables
🚂 [RAILWAY] Project type: Full-stack (backend + frontend)
📤 [DEPLOY] Progress: 🚂 Creating Railway project...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway init --name test23
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway init --name test23
📤 [DEPLOY STDOUT] > Select a workspace brunobertapeli's Projects

📤 [DEPLOY] Progress: > Select a workspace brunobertapeli's Projects

📤 [DEPLOY STDOUT] > Project Name test23

📤 [DEPLOY] Progress: > Project Name test23

📤 [DEPLOY STDOUT] 
Created project test23 on brunobertapeli's Projects
https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab

📤 [DEPLOY] Progress: 
Created project test23 on brunobertapeli's Projects
https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab

📤 [DEPLOY] Progress: ✅ Project created with ID: b9fdc612-73a3-40d1-a0d6-084f202fecab
🔗 [RAILWAY] Environment ID: ecc3ddc6-2048-4cca-8241-bcbd93108535
📤 [DEPLOY] Progress: 🔧 Creating backend service...
🔗 [RAILWAY] Backend Service created via API: a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: 🔧 Deploying backend service...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/backend
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/backend
📤 [DEPLOY STDOUT] Indexing...

📤 [DEPLOY] Progress: Indexing...

📤 [DEPLOY STDOUT] Uploading...

📤 [DEPLOY] Progress: Uploading...

📤 [DEPLOY STDOUT]   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/a76a0fb0-87d0-4a4a-80a1-bf896b42d95f?id=0d0694c3-ff0e-42be-9294-216cbcae8b2d&

📤 [DEPLOY] Progress:   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/a76a0fb0-87d0-4a4a-80a1-bf896b42d95f?id=0d0694c3-ff0e-42be-9294-216cbcae8b2d&

🔗 [RAILWAY] Backend Service ID: a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: 🌐 Getting backend URL...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway domain --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway domain --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY STDOUT] Service Domain created:
🚀 https://test23-backend-production.up.railway.app

📤 [DEPLOY] Progress: Service Domain created:
🚀 https://test23-backend-production.up.railway.app

🔗 [RAILWAY] Backend URL: https://test23-backend-production.up.railway.app
📤 [DEPLOY] Progress: 🔐 Setting backend environment variables...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set PORT=3144 --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set PORT=3144 --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set FRONTEND_URL=http://localhost:5300 --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set FRONTEND_URL=http://localhost:5300 --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set MONGODB_URI=mongodb+srv://dfadmin:25r4qNw45SpO8b6T@projects.0d16jzt.mongodb.net/codedeck?retryWrites=true&w=majority --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set MONGODB_URI=mongodb+srv://dfadmin:25r4qNw45SpO8b6T@projects.0d16jzt.mongodb.net/codedeck?retryWrites=true&w=majority --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set MONGODB_DB=codedecktest --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set MONGODB_DB=codedecktest --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: 🎨 Creating frontend service...
🔗 [RAILWAY] Frontend Service created via API: 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
📤 [DEPLOY] Progress: 🎨 Deploying frontend service...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/frontend
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/frontend
📤 [DEPLOY STDOUT] Indexing...

📤 [DEPLOY] Progress: Indexing...

📤 [DEPLOY STDOUT] Uploading...

📤 [DEPLOY] Progress: Uploading...

📤 [DEPLOY STDOUT]   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/1a8a0baa-f9ca-485a-b593-9afeadb1d89a?id=111348c1-8029-48e4-b369-1e83d36e1000&

📤 [DEPLOY] Progress:   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/1a8a0baa-f9ca-485a-b593-9afeadb1d89a?id=111348c1-8029-48e4-b369-1e83d36e1000&

🔗 [RAILWAY] Frontend Service ID: 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
📤 [DEPLOY] Progress: 🌐 Getting frontend URL...
🔗 [RAILWAY] Frontend URL via API: https://test23-frontend-production.up.railway.app
📤 [DEPLOY] Progress: 🔐 Setting frontend environment variables...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set VITE_API_URL=https://test23-backend-production.up.railway.app --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set VITE_API_URL=https://test23-backend-production.up.railway.app --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set VITE_GA_ID=G-8NGLL2W3H5 --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set VITE_GA_ID=G-8NGLL2W3H5 --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set VITE_PROJECT_ID=proj_1764711520745_4a9onf7kh --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set VITE_PROJECT_ID=proj_1764711520745_4a9onf7kh --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
📤 [DEPLOY] Progress: 🔄 Updating backend with frontend URL...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set FRONTEND_URL=https://test23-frontend-production.up.railway.app --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set FRONTEND_URL=https://test23-frontend-production.up.railway.app --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: 🔄 Redeploying services with environment variables...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/backend
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/backend
📤 [DEPLOY STDOUT] Indexing...

📤 [DEPLOY] Progress: Indexing...

📤 [DEPLOY STDOUT] Uploading...

📤 [DEPLOY] Progress: Uploading...

📤 [DEPLOY STDOUT]   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/a76a0fb0-87d0-4a4a-80a1-bf896b42d95f?id=adf35d69-f061-4643-a075-6571fb825c8b&

📤 [DEPLOY] Progress:   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/a76a0fb0-87d0-4a4a-80a1-bf896b42d95f?id=adf35d69-f061-4643-a075-6571fb825c8b&

🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/frontend
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/frontend
📤 [DEPLOY STDOUT] Indexing...

📤 [DEPLOY] Progress: Indexing...

📤 [DEPLOY STDOUT] Uploading...

📤 [DEPLOY] Progress: Uploading...

📤 [DEPLOY STDOUT]   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/1a8a0baa-f9ca-485a-b593-9afeadb1d89a?id=7920e9f5-b23f-4c6f-ada9-2b0e273ae6aa&

📤 [DEPLOY] Progress:   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/1a8a0baa-f9ca-485a-b593-9afeadb1d89a?id=7920e9f5-b23f-4c6f-ada9-2b0e273ae6aa&

📤 [DEPLOY] Progress: ⏳ Waiting for Railway to build and deploy...
📤 [DEPLOY] Progress: 🔨 Backend: BUILDING
🚂 [RAILWAY] Service Backend (a76a0fb0-87d0-4a4a-80a1-bf896b42d95f): BUILDING
📤 [DEPLOY] Progress: ⏳ Frontend: INITIALIZING
🚂 [RAILWAY] Service Frontend (1a8a0baa-f9ca-485a-b593-9afeadb1d89a): INITIALIZING
📤 [DEPLOY] Progress: 🔨 Frontend: BUILDING
🚂 [RAILWAY] Service Frontend (1a8a0baa-f9ca-485a-b593-9afeadb1d89a): BUILDING
📤 [DEPLOY] Progress: 🚀 Frontend: DEPLOYING
🚂 [RAILWAY] Service Frontend (1a8a0baa-f9ca-485a-b593-9afeadb1d89a): DEPLOYING
📤 [DEPLOY] Progress: 🚀 Backend: DEPLOYING
🚂 [RAILWAY] Service Backend (a76a0fb0-87d0-4a4a-80a1-bf896b42d95f): DEPLOYING
📤 [DEPLOY] Progress: ✅ Frontend: SUCCESS
🚂 [RAILWAY] Service Frontend (1a8a0baa-f9ca-485a-b593-9afeadb1d89a): SUCCESS
📤 [DEPLOY] Progress: ✅ Backend: SUCCESS
🚂 [RAILWAY] Service Backend (a76a0fb0-87d0-4a4a-80a1-bf896b42d95f): SUCCESS
📤 [DEPLOY] Progress: ✅ Full-stack deployed! Frontend: https://test23-frontend-production.up.railway.app
✅ [RAILWAY] Deploy complete! Frontend: https://test23-frontend-production.up.railway.app, Backend: https://test23-backend-production.up.railway.app
fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.
Use '--' to separate paths from revisions, like this:
'git <command> [<revision>...] -- [<file>...]'
Failed to get HEAD commit: Error: Command failed: git rev-parse HEAD
fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.
Use '--' to separate paths from revisions, like this:
'git <command> [<revision>...] -- [<file>...]'

    at genericNodeError (node:internal/errors:984:15)
    at wrappedFn (node:internal/errors:538:14)
    at checkExecSyncError (node:child_process:906:11)
    at execSync (node:child_process:978:15)
    at getHeadCommit (file:///Users/brunobertapeli/Desktop/BeeSwarmv2/dist-electron/main.js:30218:20)
    at file:///Users/brunobertapeli/Desktop/BeeSwarmv2/dist-electron/main.js:30423:28
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async WebContents.<anonymous> (node:electron/js2c/browser_init:2:86160) {
  status: 128,
  signal: null,
  output: [
    null,
    'HEAD\n',
    "fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.\n" +
      "Use '--' to separate paths from revisions, like this:\n" +
      "'git <command> [<revision>...] -- [<file>...]'\n"
  ],
  pid: 2079,
  stdout: 'HEAD\n',
  stderr: "fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.\n" +
    "Use '--' to separate paths from revisions, like this:\n" +
    "'git <command> [<revision>...] -- [<file>...]'\n"
}
fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.
Use '--' to separate paths from revisions, like this:
'git <command> [<revision>...] -- [<file>...]'
📸 [PlaceholderImageService] Scanning for manifest.json in: /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh
ℹ️ [PlaceholderImageService] No manifest.json found at template path, skipping placeholder generation
[3047:1202/164125.521291:ERROR:system_services.cc(34)] SetApplicationIsDaemon: Error Domain=NSOSStatusErrorDomain Code=-50 "paramErr: error in user parameter list" (-50)
🚀 [DEPLOY] Starting deployment for project proj_1764711520745_4a9onf7kh to railway
📤 [DEPLOY] Progress: Starting deployment to railway...
📤 [DEPLOY] Progress: Found 7 environment variables
🚂 [RAILWAY] Project type: Full-stack (backend + frontend)
🔗 [RAILWAY] Environment ID: ecc3ddc6-2048-4cca-8241-bcbd93108535
📤 [DEPLOY] Progress: 🔍 Checking existing services...
🔗 [RAILWAY] Found existing Frontend Service: 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
🔗 [RAILWAY] Found existing Backend Service: a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: 🔧 Redeploying backend service...
📤 [DEPLOY] Progress: 🔧 Deploying backend service...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/backend
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/backend
📤 [DEPLOY STDOUT] Indexing...

📤 [DEPLOY] Progress: Indexing...

📤 [DEPLOY STDOUT] Uploading...

📤 [DEPLOY] Progress: Uploading...

📤 [DEPLOY STDOUT]   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/a76a0fb0-87d0-4a4a-80a1-bf896b42d95f?id=6a8e0aed-03a3-45db-aa19-9fc0308c2bf0&

📤 [DEPLOY] Progress:   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/a76a0fb0-87d0-4a4a-80a1-bf896b42d95f?id=6a8e0aed-03a3-45db-aa19-9fc0308c2bf0&

🔗 [RAILWAY] Backend Service ID: a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: 🌐 Getting backend URL...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway domain --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway domain --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY STDERR] Service "a76a0fb0-87d0-4a4a-80a1-bf896b42d95f" not found.

📤 [DEPLOY] Progress: Service "a76a0fb0-87d0-4a4a-80a1-bf896b42d95f" not found.

📤 [DEPLOY] Progress: 🔐 Setting backend environment variables...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set PORT=3144 --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set PORT=3144 --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set FRONTEND_URL=http://localhost:5300 --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set FRONTEND_URL=http://localhost:5300 --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set MONGODB_URI=mongodb+srv://dfadmin:25r4qNw45SpO8b6T@projects.0d16jzt.mongodb.net/codedeck?retryWrites=true&w=majority --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set MONGODB_URI=mongodb+srv://dfadmin:25r4qNw45SpO8b6T@projects.0d16jzt.mongodb.net/codedeck?retryWrites=true&w=majority --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set MONGODB_DB=codedecktest --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set MONGODB_DB=codedecktest --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: 🎨 Redeploying frontend service...
📤 [DEPLOY] Progress: 🎨 Deploying frontend service...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/frontend
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/frontend
📤 [DEPLOY STDOUT] Indexing...

📤 [DEPLOY] Progress: Indexing...

📤 [DEPLOY STDOUT] Uploading...

📤 [DEPLOY] Progress: Uploading...

📤 [DEPLOY STDOUT]   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/1a8a0baa-f9ca-485a-b593-9afeadb1d89a?id=bf62c1df-1b4e-46de-b5a5-7a9e29253311&

📤 [DEPLOY] Progress:   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/1a8a0baa-f9ca-485a-b593-9afeadb1d89a?id=bf62c1df-1b4e-46de-b5a5-7a9e29253311&

🔗 [RAILWAY] Frontend Service ID: 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
📤 [DEPLOY] Progress: 🌐 Getting frontend URL...
🔗 [RAILWAY] Frontend URL via API: https://test23-frontend-production-74cf.up.railway.app
📤 [DEPLOY] Progress: 🔐 Setting frontend environment variables...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set VITE_GA_ID=G-8NGLL2W3H5 --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set VITE_GA_ID=G-8NGLL2W3H5 --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set VITE_PROJECT_ID=proj_1764711520745_4a9onf7kh --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set VITE_PROJECT_ID=proj_1764711520745_4a9onf7kh --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a
📤 [DEPLOY] Progress: 🔄 Updating backend with frontend URL...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set FRONTEND_URL=https://test23-frontend-production-74cf.up.railway.app --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway variables --set FRONTEND_URL=https://test23-frontend-production-74cf.up.railway.app --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f
📤 [DEPLOY] Progress: 🔄 Redeploying services with environment variables...
🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/backend
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service a76a0fb0-87d0-4a4a-80a1-bf896b42d95f /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/backend
📤 [DEPLOY STDOUT] Indexing...

📤 [DEPLOY] Progress: Indexing...

📤 [DEPLOY STDOUT] Uploading...

📤 [DEPLOY] Progress: Uploading...

📤 [DEPLOY STDOUT]   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/a76a0fb0-87d0-4a4a-80a1-bf896b42d95f?id=38abae05-2df6-475d-9c30-817b8f9c44af&

📤 [DEPLOY] Progress:   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/a76a0fb0-87d0-4a4a-80a1-bf896b42d95f?id=38abae05-2df6-475d-9c30-817b8f9c44af&

🚀 [DEPLOY] Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/frontend
📤 [DEPLOY] Progress: Running: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway up --detach --path-as-root --service 1a8a0baa-f9ca-485a-b593-9afeadb1d89a /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711520745_4a9onf7kh/frontend
📤 [DEPLOY STDOUT] Indexing...

📤 [DEPLOY] Progress: Indexing...

📤 [DEPLOY STDOUT] Uploading...

📤 [DEPLOY] Progress: Uploading...

📤 [DEPLOY STDOUT]   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/1a8a0baa-f9ca-485a-b593-9afeadb1d89a?id=6433e05f-2f3d-4d63-9783-c5081dc9e29d&

📤 [DEPLOY] Progress:   Build Logs: https://railway.com/project/b9fdc612-73a3-40d1-a0d6-084f202fecab/service/1a8a0baa-f9ca-485a-b593-9afeadb1d89a?id=6433e05f-2f3d-4d63-9783-c5081dc9e29d&

📤 [DEPLOY] Progress: ⏳ Waiting for Railway to build and deploy...
📤 [DEPLOY] Progress: 🔨 Backend: BUILDING
🚂 [RAILWAY] Service Backend (a76a0fb0-87d0-4a4a-80a1-bf896b42d95f): BUILDING
📤 [DEPLOY] Progress: ⏳ Frontend: INITIALIZING
🚂 [RAILWAY] Service Frontend (1a8a0baa-f9ca-485a-b593-9afeadb1d89a): INITIALIZING
📤 [DEPLOY] Progress: 🔨 Frontend: BUILDING
🚂 [RAILWAY] Service Frontend (1a8a0baa-f9ca-485a-b593-9afeadb1d89a): BUILDING
📤 [DEPLOY] Progress: 🚀 Frontend: DEPLOYING
🚂 [RAILWAY] Service Frontend (1a8a0baa-f9ca-485a-b593-9afeadb1d89a): DEPLOYING
📤 [DEPLOY] Progress: 🚀 Backend: DEPLOYING
🚂 [RAILWAY] Service Backend (a76a0fb0-87d0-4a4a-80a1-bf896b42d95f): DEPLOYING
📤 [DEPLOY] Progress: ✅ Frontend: SUCCESS
🚂 [RAILWAY] Service Frontend (1a8a0baa-f9ca-485a-b593-9afeadb1d89a): SUCCESS
📤 [DEPLOY] Progress: ✅ Backend: SUCCESS
🚂 [RAILWAY] Service Backend (a76a0fb0-87d0-4a4a-80a1-bf896b42d95f): SUCCESS
📤 [DEPLOY] Progress: ✅ Full-stack deployed! Frontend: https://test23-frontend-production-74cf.up.railway.app
✅ [RAILWAY] Deploy complete! Frontend: https://test23-frontend-production-74cf.up.railway.app, Backend: undefined
📤 [DEPLOY] Progress: 📌 Deployed commit: 3d89f69