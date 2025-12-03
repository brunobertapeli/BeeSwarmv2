🚀 Initializing Deployment Service...
[DeploymentService] Dev mode - looking for Railway CLI at: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway
✅ Railway CLI ready: /Users/brunobertapeli/Desktop/BeeSwarmv2/resources/binaries/darwin-arm64/railway (v4.12.0)
[DeploymentService] Looking for Netlify CLI in: [
  '/Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js'
]
[DeploymentService] Found Netlify CLI at: /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js
[97590:1202/163218.549171:ERROR:CONSOLE(1)] "Request Autofill.enable failed. {"code":-32601,"message":"'Autofill.enable' wasn't found"}", source: devtools://devtools/bundled/core/protocol_client/protocol_client.js (1)
[97590:1202/163218.549194:ERROR:CONSOLE(1)] "Request Autofill.setAddresses failed. {"code":-32601,"message":"'Autofill.setAddresses' wasn't found"}", source: devtools://devtools/bundled/core/protocol_client/protocol_client.js (1)
✅ Netlify CLI ready: /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js (v23.12.2)
==================================================
DEPLOYMENT CLI STATUS
==================================================
✅ Railway CLI ready: v4.12.0
✅ Netlify CLI ready: v23.12.2
==================================================
fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.
Use '--' to separate paths from revisions, like this:
'git <command> [<revision>...] -- [<file>...]'
fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.
Use '--' to separate paths from revisions, like this:
'git <command> [<revision>...] -- [<file>...]'
🚀 [DEPLOY] Starting deployment for project proj_1764711168144_0ssjhiwmi to netlify
📤 [DEPLOY] Progress: Starting deployment to netlify...
📤 [DEPLOY] Progress: Found 2 environment variables
📤 [DEPLOY] Progress: 📦 Building project...
🔨 [NETLIFY] Building project...
🚀 [DEPLOY] Running: npm run build
📤 [DEPLOY] Progress: Running: npm run build
📤 [DEPLOY STDOUT] 
> beeswarm-template@1.0.0 build
> cd frontend && npm run build


📤 [DEPLOY] Progress: 
> beeswarm-template@1.0.0 build
> cd frontend && npm run build


📤 [DEPLOY STDOUT] 
> template-frontend@1.0.0 build
> vite build


📤 [DEPLOY] Progress: 
> template-frontend@1.0.0 build
> vite build


📤 [DEPLOY STDOUT] vite v6.4.1 building for production...

📤 [DEPLOY] Progress: vite v6.4.1 building for production...

📤 [DEPLOY STDOUT] transforming...

📤 [DEPLOY] Progress: transforming...

📤 [DEPLOY STDOUT] ✓ 828 modules transformed.

📤 [DEPLOY] Progress: ✓ 828 modules transformed.

📤 [DEPLOY STDOUT] rendering chunks...

📤 [DEPLOY] Progress: rendering chunks...

📤 [DEPLOY STDOUT] computing gzip size...

📤 [DEPLOY] Progress: computing gzip size...

📤 [DEPLOY STDOUT] dist/index.html                    0.77 kB │ gzip:   0.45 kB
dist/assets/index-DN6su3Ny.css    28.46 kB │ gzip:   5.69 kB

📤 [DEPLOY] Progress: dist/index.html                    0.77 kB │ gzip:   0.45 kB
dist/assets/index-DN6su3Ny.css    28.46 kB │ gzip:   5.69 kB

📤 [DEPLOY STDOUT] dist/assets/browser-MXnRZz49.js    0.34 kB │ gzip:   0.28 kB
dist/assets/index-BBNgAD6n.js    878.36 kB │ gzip: 233.62 kB

📤 [DEPLOY] Progress: dist/assets/browser-MXnRZz49.js    0.34 kB │ gzip:   0.28 kB
dist/assets/index-BBNgAD6n.js    878.36 kB │ gzip: 233.62 kB

📤 [DEPLOY STDERR] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

📤 [DEPLOY] Progress: 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

📤 [DEPLOY STDOUT] ✓ built in 1.06s

📤 [DEPLOY] Progress: ✓ built in 1.06s

📤 [DEPLOY] Progress: ✅ Build complete!
📁 [NETLIFY] Found build output at: frontend/dist
📤 [DEPLOY] Progress: 🌐 Creating Netlify site...
🌐 [NETLIFY] Creating site...
🚀 [DEPLOY] Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js sites:create --name test1 --manual
📤 [DEPLOY] Progress: Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js sites:create --name test1 --manual
📤 [DEPLOY STDOUT] ? Team: (Use arrow keys)
❯ brunobertapeli 
📤 [DEPLOY] Progress: ? Team: (Use arrow keys)
❯ brunobertapeli 

📤 [DEPLOY STDOUT] ? Team: brunobertapeli
📤 [DEPLOY] Progress: ? Team: brunobertapeli
📤 [DEPLOY STDOUT] 

📤 [DEPLOY] Progress: 

📤 [DEPLOY STDOUT]  ›   Warning: test1.netlify.app already exists. Please try a different slug.

📤 [DEPLOY] Progress:  ›   Warning: test1.netlify.app already exists. Please try a different slug.

📤 [DEPLOY STDOUT] ? Project name (leave blank for a random name; you can change it later): 
📤 [DEPLOY] Progress: ? Project name (leave blank for a random name; you can change it later): 
📤 [DEPLOY STDERR] Warning: Detected unsettled top-level await at file:///Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js:66
await main()
^




📤 [DEPLOY] Progress: Warning: Detected unsettled top-level await at file:///Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js:66
await main()
^




📤 [DEPLOY STDERR]  ›   Error: Netlify CLI has terminated unexpectedly
This is a problem with the Netlify CLI, not with your application.
If you recently updated the CLI, consider reverting to an older version by running:

npm install -g netlify-cli@VERSION

You can use any version from https://ntl.fyi/cli-versions.

Please report this problem at https://ntl.fyi/cli-error including the error details below.


📤 [DEPLOY] Progress:  ›   Error: Netlify CLI has terminated unexpectedly
This is a problem with the Netlify CLI, not with your application.
If you recently updated the CLI, consider reverting to an older version by running:

npm install -g netlify-cli@VERSION

You can use any version from https://ntl.fyi/cli-versions.

Please report this problem at https://ntl.fyi/cli-error including the error details below.


🚀 [DEPLOY] Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js sites:create --name test1-1764711195191 --manual
📤 [DEPLOY] Progress: Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js sites:create --name test1-1764711195191 --manual
📤 [DEPLOY STDOUT] ? Team: (Use arrow keys)
❯ brunobertapeli 
📤 [DEPLOY] Progress: ? Team: (Use arrow keys)
❯ brunobertapeli 

📤 [DEPLOY STDOUT] ? Team: brunobertapeli
📤 [DEPLOY] Progress: ? Team: brunobertapeli
📤 [DEPLOY STDOUT] 

📤 [DEPLOY] Progress: 

📤 [DEPLOY STDOUT] 
Project Created


📤 [DEPLOY] Progress: 
Project Created


📤 [DEPLOY STDOUT] Admin URL:  https://app.netlify.com/projects/test1-1764711195191
URL:        https://test1-1764711195191.netlify.app
Project ID: 8dda6a86-0d6f-4b3e-970a-94b5e96f2e8d

📤 [DEPLOY] Progress: Admin URL:  https://app.netlify.com/projects/test1-1764711195191
URL:        https://test1-1764711195191.netlify.app
Project ID: 8dda6a86-0d6f-4b3e-970a-94b5e96f2e8d

📤 [DEPLOY STDOUT] 

📤 [DEPLOY] Progress: 

📤 [DEPLOY STDOUT] ✔ Linked to test1-1764711195191

📤 [DEPLOY] Progress: ✔ Linked to test1-1764711195191

📤 [DEPLOY] Progress: 🚀 Deploying to Netlify...
🚀 [NETLIFY] Deploying...
🚀 [DEPLOY] Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js deploy --prod --dir frontend/dist --no-build
📤 [DEPLOY] Progress: Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js deploy --prod --dir frontend/dist --no-build
📤 [DEPLOY STDOUT] 
Deploying to Netlify
────────────────────────────────────────────────────────────────


📤 [DEPLOY] Progress: 
Deploying to Netlify
────────────────────────────────────────────────────────────────


📤 [DEPLOY STDOUT] Deploy path:        /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/frontend/dist
Functions path:     /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/netlify/functions
Configuration path: /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/netlify.toml


📤 [DEPLOY] Progress: Deploy path:        /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/frontend/dist
Functions path:     /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/netlify/functions
Configuration path: /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/netlify.toml


📤 [DEPLOY STDERR] ⠋ Uploading blobs to deploy store...


📤 [DEPLOY] Progress: ⠋ Uploading blobs to deploy store...


📤 [DEPLOY STDERR] ✔ Finished uploading blobs to deploy store

📤 [DEPLOY] Progress: ✔ Finished uploading blobs to deploy store

📤 [DEPLOY STDERR] ⠋ Hashing files...

📤 [DEPLOY] Progress: ⠋ Hashing files...

📤 [DEPLOY STDERR] ⠋ Looking for a functions cache...
✔ No cached functions were found

📤 [DEPLOY] Progress: ⠋ Looking for a functions cache...
✔ No cached functions were found

📤 [DEPLOY STDERR] ✔ Finished hashing 14 files and 4 functions
⠋ CDN diffing files...

📤 [DEPLOY] Progress: ✔ Finished hashing 14 files and 4 functions
⠋ CDN diffing files...

📤 [DEPLOY STDERR] ✔ CDN requesting 4 files and 4 functions

📤 [DEPLOY] Progress: ✔ CDN requesting 4 files and 4 functions

📤 [DEPLOY STDERR] ⠋ Uploading 8 files

📤 [DEPLOY] Progress: ⠋ Uploading 8 files

📤 [DEPLOY STDERR] ✔ Finished uploading 8 assets
⠋ Waiting for deploy to go live...

📤 [DEPLOY] Progress: ✔ Finished uploading 8 assets
⠋ Waiting for deploy to go live...

📤 [DEPLOY STDERR] ✔ Deploy is live!

📤 [DEPLOY] Progress: ✔ Deploy is live!

📤 [DEPLOY STDOUT] 
🚀 Deploy complete
────────────────────────────────────────────────────────────────

📤 [DEPLOY] Progress: 
🚀 Deploy complete
────────────────────────────────────────────────────────────────

📤 [DEPLOY STDOUT] 
  ╭──────────────────── ⬥  Production deploy is live ⬥  ────────────────────╮
  │                                                                         │
  │   Deployed to production URL: https://test1-1764711195191.netlify.app   │
  │                                                                         │
  │                           Unique deploy URL:                            │
  │    https://692f5b1fd4bb5fa34bedd973--test1-1764711195191.netlify.app    │
  │                                                                         │
  ╰─────────────────────────────────────────────────────────────────────────╯


📤 [DEPLOY] Progress: 
  ╭──────────────────── ⬥  Production deploy is live ⬥  ────────────────────╮
  │                                                                         │
  │   Deployed to production URL: https://test1-1764711195191.netlify.app   │
  │                                                                         │
  │                           Unique deploy URL:                            │
  │    https://692f5b1fd4bb5fa34bedd973--test1-1764711195191.netlify.app    │
  │                                                                         │
  ╰─────────────────────────────────────────────────────────────────────────╯


📤 [DEPLOY STDOUT] Build logs:         https://app.netlify.com/projects/test1-1764711195191/deploys/692f5b1fd4bb5fa34bedd973
Function logs:      https://app.netlify.com/projects/test1-1764711195191/logs/functions
Edge function Logs: https://app.netlify.com/projects/test1-1764711195191/logs/edge-functions

📤 [DEPLOY] Progress: Build logs:         https://app.netlify.com/projects/test1-1764711195191/deploys/692f5b1fd4bb5fa34bedd973
Function logs:      https://app.netlify.com/projects/test1-1764711195191/logs/functions
Edge function Logs: https://app.netlify.com/projects/test1-1764711195191/logs/edge-functions

📤 [DEPLOY] Progress: ✅ Deployed successfully! Live at: https://test1-1764711195191.netlify.app
✅ [NETLIFY] Deploy complete! URL: https://test1-1764711195191.netlify.app
🧹 [NETLIFY] Cleaned siteId from state.json to preserve local dev
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
  pid: 99028,
  stdout: 'HEAD\n',
  stderr: "fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.\n" +
    "Use '--' to separate paths from revisions, like this:\n" +
    "'git <command> [<revision>...] -- [<file>...]'\n"
}
📤 [DEPLOY] Progress: 🔄 Restarting dev server...
📤 [DEPLOY] Progress: ✅ Dev server restarted
fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.
Use '--' to separate paths from revisions, like this:
'git <command> [<revision>...] -- [<file>...]'
📸 [PlaceholderImageService] Scanning for manifest.json in: /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi
✅ [PlaceholderImageService] Found manifest at: /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/frontend/public/assets/images/manifest.json
📋 [PlaceholderImageService] Found 7 images in manifest
✓ [PlaceholderImageService] Image already exists, skipping: about-team.png
✓ [PlaceholderImageService] Image already exists, skipping: documentation-icon.png
✓ [PlaceholderImageService] Image already exists, skipping: features-icon.png
✓ [PlaceholderImageService] Image already exists, skipping: hero-illustration.png
✓ [PlaceholderImageService] Image already exists, skipping: logo.png
✓ [PlaceholderImageService] Image already exists, skipping: pricing-chart.png
✓ [PlaceholderImageService] Image already exists, skipping: testimonial-avatar.png
🧹 [PlaceholderImageService] Cleared manifest.json for next cycle
[840:1202/163603.034011:ERROR:system_services.cc(34)] SetApplicationIsDaemon: Error Domain=NSOSStatusErrorDomain Code=-50 "paramErr: error in user parameter list" (-50)
🚀 [DEPLOY] Starting deployment for project proj_1764711168144_0ssjhiwmi to netlify
📤 [DEPLOY] Progress: Starting deployment to netlify...
📤 [DEPLOY] Progress: Found 2 environment variables
📤 [DEPLOY] Progress: 📦 Building project...
🔨 [NETLIFY] Building project...
🚀 [DEPLOY] Running: npm run build
📤 [DEPLOY] Progress: Running: npm run build
📤 [DEPLOY STDOUT] 
> beeswarm-template@1.0.0 build
> cd frontend && npm run build


📤 [DEPLOY] Progress: 
> beeswarm-template@1.0.0 build
> cd frontend && npm run build


📤 [DEPLOY STDOUT] 
> template-frontend@1.0.0 build
> vite build


📤 [DEPLOY] Progress: 
> template-frontend@1.0.0 build
> vite build


📤 [DEPLOY STDOUT] vite v6.4.1 building for production...

📤 [DEPLOY] Progress: vite v6.4.1 building for production...

📤 [DEPLOY STDOUT] transforming...

📤 [DEPLOY] Progress: transforming...

📤 [DEPLOY STDOUT] ✓ 828 modules transformed.

📤 [DEPLOY] Progress: ✓ 828 modules transformed.

📤 [DEPLOY STDOUT] rendering chunks...

📤 [DEPLOY] Progress: rendering chunks...

📤 [DEPLOY STDOUT] computing gzip size...

📤 [DEPLOY] Progress: computing gzip size...

📤 [DEPLOY STDOUT] dist/index.html                    0.77 kB │ gzip:   0.45 kB
dist/assets/index-DN6su3Ny.css    28.46 kB │ gzip:   5.69 kB

📤 [DEPLOY] Progress: dist/index.html                    0.77 kB │ gzip:   0.45 kB
dist/assets/index-DN6su3Ny.css    28.46 kB │ gzip:   5.69 kB

📤 [DEPLOY STDOUT] dist/assets/browser-BvDz0xLy.js    0.34 kB │ gzip:   0.27 kB
dist/assets/index-CbdBSFkr.js    878.36 kB │ gzip: 233.62 kB

📤 [DEPLOY] Progress: dist/assets/browser-BvDz0xLy.js    0.34 kB │ gzip:   0.27 kB
dist/assets/index-CbdBSFkr.js    878.36 kB │ gzip: 233.62 kB

📤 [DEPLOY STDERR] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

📤 [DEPLOY] Progress: 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

📤 [DEPLOY STDOUT] ✓ built in 1.05s

📤 [DEPLOY] Progress: ✓ built in 1.05s

📤 [DEPLOY] Progress: ✅ Build complete!
📁 [NETLIFY] Found build output at: frontend/dist
📤 [DEPLOY] Progress: 🌐 Creating Netlify site...
🌐 [NETLIFY] Creating site...
🚀 [DEPLOY] Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js sites:create --name test1 --manual
📤 [DEPLOY] Progress: Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js sites:create --name test1 --manual
📤 [DEPLOY STDOUT] ? Team: (Use arrow keys)
❯ brunobertapeli 
📤 [DEPLOY] Progress: ? Team: (Use arrow keys)
❯ brunobertapeli 

📤 [DEPLOY STDOUT] ? Team: brunobertapeli
📤 [DEPLOY] Progress: ? Team: brunobertapeli
📤 [DEPLOY STDOUT] 

📤 [DEPLOY] Progress: 

📤 [DEPLOY STDOUT]  ›   Warning: test1.netlify.app already exists. Please try a different slug.

📤 [DEPLOY] Progress:  ›   Warning: test1.netlify.app already exists. Please try a different slug.

📤 [DEPLOY STDOUT] ? Project name (leave blank for a random name; you can change it later): 
📤 [DEPLOY] Progress: ? Project name (leave blank for a random name; you can change it later): 
📤 [DEPLOY STDOUT] 
📤 [DEPLOY] Progress: 
📤 [DEPLOY STDERR] Warning: Detected unsettled top-level await at file:///Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js:66
await main()
^




📤 [DEPLOY] Progress: Warning: Detected unsettled top-level await at file:///Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js:66
await main()
^




📤 [DEPLOY STDERR]  ›   Error: Netlify CLI has terminated unexpectedly
This is a problem with the Netlify CLI, not with your application.
If you recently updated the CLI, consider reverting to an older version by running:

npm install -g netlify-cli@VERSION

You can use any version from https://ntl.fyi/cli-versions.

Please report this problem at https://ntl.fyi/cli-error including the error details below.


📤 [DEPLOY] Progress:  ›   Error: Netlify CLI has terminated unexpectedly
This is a problem with the Netlify CLI, not with your application.
If you recently updated the CLI, consider reverting to an older version by running:

npm install -g netlify-cli@VERSION

You can use any version from https://ntl.fyi/cli-versions.

Please report this problem at https://ntl.fyi/cli-error including the error details below.


🚀 [DEPLOY] Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js sites:create --name test1-1764711389612 --manual
📤 [DEPLOY] Progress: Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js sites:create --name test1-1764711389612 --manual
📤 [DEPLOY STDOUT] ? Team: (Use arrow keys)
❯ brunobertapeli 
📤 [DEPLOY] Progress: ? Team: (Use arrow keys)
❯ brunobertapeli 

📤 [DEPLOY STDOUT] ? Team: brunobertapeli
📤 [DEPLOY] Progress: ? Team: brunobertapeli
📤 [DEPLOY STDOUT] 

📤 [DEPLOY] Progress: 

📤 [DEPLOY STDOUT] 
Project Created


📤 [DEPLOY] Progress: 
Project Created


📤 [DEPLOY STDOUT] Admin URL:  https://app.netlify.com/projects/test1-1764711389612
URL:        https://test1-1764711389612.netlify.app
Project ID: aca0ccb1-f7a2-40ac-973d-d46de26f6436

📤 [DEPLOY] Progress: Admin URL:  https://app.netlify.com/projects/test1-1764711389612
URL:        https://test1-1764711389612.netlify.app
Project ID: aca0ccb1-f7a2-40ac-973d-d46de26f6436

📤 [DEPLOY STDOUT] 

📤 [DEPLOY] Progress: 

📤 [DEPLOY STDOUT] ✔ Linked to test1-1764711389612

📤 [DEPLOY] Progress: ✔ Linked to test1-1764711389612

📤 [DEPLOY] Progress: 🚀 Deploying to Netlify...
🚀 [NETLIFY] Deploying...
🚀 [DEPLOY] Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js deploy --prod --dir frontend/dist --no-build
📤 [DEPLOY] Progress: Running: /opt/homebrew/bin/node /Users/brunobertapeli/Desktop/BeeSwarmv2/node_modules/netlify-cli/bin/run.js deploy --prod --dir frontend/dist --no-build
📤 [DEPLOY STDOUT] 
Deploying to Netlify
────────────────────────────────────────────────────────────────


📤 [DEPLOY] Progress: 
Deploying to Netlify
────────────────────────────────────────────────────────────────


📤 [DEPLOY STDOUT] Deploy path:        /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/frontend/dist
Functions path:     /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/netlify/functions
Configuration path: /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/netlify.toml


📤 [DEPLOY] Progress: Deploy path:        /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/frontend/dist
Functions path:     /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/netlify/functions
Configuration path: /Users/brunobertapeli/Documents/CodeDeck/52f8d183-31c7-4579-befe-197b623d7a96/Projects/proj_1764711168144_0ssjhiwmi/netlify.toml


📤 [DEPLOY STDERR] ⠋ Uploading blobs to deploy store...


📤 [DEPLOY] Progress: ⠋ Uploading blobs to deploy store...


📤 [DEPLOY STDERR] ✔ Finished uploading blobs to deploy store

📤 [DEPLOY] Progress: ✔ Finished uploading blobs to deploy store

📤 [DEPLOY STDERR] ⠋ Hashing files...

📤 [DEPLOY] Progress: ⠋ Hashing files...

📤 [DEPLOY STDERR] ⠋ Looking for a functions cache...
✔ No cached functions were found

📤 [DEPLOY] Progress: ⠋ Looking for a functions cache...
✔ No cached functions were found

📤 [DEPLOY STDERR] ✔ Finished hashing 14 files and 4 functions
⠋ CDN diffing files...

📤 [DEPLOY] Progress: ✔ Finished hashing 14 files and 4 functions
⠋ CDN diffing files...

📤 [DEPLOY STDERR] ✔ CDN requesting 3 files and 4 functions

📤 [DEPLOY] Progress: ✔ CDN requesting 3 files and 4 functions

📤 [DEPLOY STDERR] ⠋ Uploading 7 files

📤 [DEPLOY] Progress: ⠋ Uploading 7 files

📤 [DEPLOY STDERR] ✔ Finished uploading 7 assets
⠋ Waiting for deploy to go live...

📤 [DEPLOY] Progress: ✔ Finished uploading 7 assets
⠋ Waiting for deploy to go live...

📤 [DEPLOY STDERR] ✔ Deploy is live!

📤 [DEPLOY] Progress: ✔ Deploy is live!

📤 [DEPLOY STDOUT] 
🚀 Deploy complete
────────────────────────────────────────────────────────────────

📤 [DEPLOY] Progress: 
🚀 Deploy complete
────────────────────────────────────────────────────────────────

📤 [DEPLOY STDOUT] 
  ╭──────────────────── ⬥  Production deploy is live ⬥  ────────────────────╮
  │                                                                         │
  │   Deployed to production URL: https://test1-1764711389612.netlify.app   │
  │                                                                         │
  │                           Unique deploy URL:                            │
  │    https://692f5be1431b06c553253d01--test1-1764711389612.netlify.app    │
  │                                                                         │
  ╰─────────────────────────────────────────────────────────────────────────╯


📤 [DEPLOY] Progress: 
  ╭──────────────────── ⬥  Production deploy is live ⬥  ────────────────────╮
  │                                                                         │
  │   Deployed to production URL: https://test1-1764711389612.netlify.app   │
  │                                                                         │
  │                           Unique deploy URL:                            │
  │    https://692f5be1431b06c553253d01--test1-1764711389612.netlify.app    │
  │                                                                         │
  ╰─────────────────────────────────────────────────────────────────────────╯


📤 [DEPLOY STDOUT] Build logs:         https://app.netlify.com/projects/test1-1764711389612/deploys/692f5be1431b06c553253d01
Function logs:      https://app.netlify.com/projects/test1-1764711389612/logs/functions
Edge function Logs: https://app.netlify.com/projects/test1-1764711389612/logs/edge-functions

📤 [DEPLOY] Progress: Build logs:         https://app.netlify.com/projects/test1-1764711389612/deploys/692f5be1431b06c553253d01
Function logs:      https://app.netlify.com/projects/test1-1764711389612/logs/functions
Edge function Logs: https://app.netlify.com/projects/test1-1764711389612/logs/edge-functions

📤 [DEPLOY] Progress: ✅ Deployed successfully! Live at: https://test1-1764711389612.netlify.app
✅ [NETLIFY] Deploy complete! URL: https://test1-1764711389612.netlify.app
🧹 [NETLIFY] Cleaned siteId from state.json to preserve local dev
📤 [DEPLOY] Progress: 📌 Deployed commit: 7520394
📤 [DEPLOY] Progress: 🔄 Restarting dev server...
📤 [DEPLOY] Progress: ✅ Dev server restarted