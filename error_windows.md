  PS C:\Users\bbert\Desktop\BeeSwarmv2-main> npm install
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: '@electron/rebuild@4.0.2',
npm warn EBADENGINE   required: { node: '>=22.12.0' },
npm warn EBADENGINE   current: { node: 'v20.17.0', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'node-abi@4.24.0',
npm warn EBADENGINE   required: { node: '>=22.12.0' },
npm warn EBADENGINE   current: { node: 'v20.17.0', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'rolldown@1.0.0-beta.52',
npm warn EBADENGINE   required: { node: '^20.19.0 || >=22.12.0' },
npm warn EBADENGINE   current: { node: 'v20.17.0', npm: '10.8.2' }
npm warn EBADENGINE }
npm warn deprecated path-match@1.2.4: This package is archived and no longer maintained. For support, visit https://github.com/expressjs/express/discussions
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
npm warn deprecated asar@3.2.0: Please use @electron/asar moving forward.  There is no API change, just a package name change
npm warn deprecated boolean@3.2.0: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.
npm warn deprecated electron-osx-sign@0.6.0: Please use @electron/osx-sign moving forward. Be aware the API is slightly different
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated xterm@5.3.0: This package is now deprecated. Move to @xterm/xterm instead.
npm warn cleanup Failed to remove some directories [
npm warn cleanup   [
npm warn cleanup     'C:\\Users\\bbert\\Desktop\\BeeSwarmv2-main\\node_modules',
npm warn cleanup     [Error: EPERM: operation not permitted, rmdir 'C:\Users\bbert\Desktop\BeeSwarmv2-main\node_modules\netlify-cli\node_modules\@cspotcode\source-map-support\node_modules\@jridgewell'] {
npm warn cleanup       errno: -4048,
npm warn cleanup       code: 'EPERM',
npm warn cleanup       syscall: 'rmdir',
npm warn cleanup       path: 'C:\\Users\\bbert\\Desktop\\BeeSwarmv2-main\\node_modules\\netlify-cli\\node_modules\\@cspotcode\\source-map-support\\node_modules\\@jridgewell'     
npm warn cleanup     }
npm warn cleanup   ],
npm warn cleanup   [
npm warn cleanup     'C:\\Users\\bbert\\Desktop\\BeeSwarmv2-main\\node_modules\\netlify-cli',
npm warn cleanup     [Error: EPERM: operation not permitted, rmdir 'C:\Users\bbert\Desktop\BeeSwarmv2-main\node_modules\netlify-cli\node_modules\@cspotcode\source-map-support'] {
npm warn cleanup       errno: -4048,
npm warn cleanup       code: 'EPERM',
npm warn cleanup       syscall: 'rmdir',
npm warn cleanup       path: 'C:\\Users\\bbert\\Desktop\\BeeSwarmv2-main\\node_modules\\netlify-cli\\node_modules\\@cspotcode\\source-map-support'
npm warn cleanup     }
npm warn cleanup   ],
npm warn cleanup   [
npm warn cleanup     'C:\\Users\\bbert\\Desktop\\BeeSwarmv2-main\\node_modules\\@grpc',
npm warn cleanup     [Error: EPERM: operation not permitted, rmdir 'C:\Users\bbert\Desktop\BeeSwarmv2-main\node_modules\@grpc\grpc-js\build'] {
npm warn cleanup       errno: -4048,
npm warn cleanup       code: 'EPERM',
npm warn cleanup       syscall: 'rmdir',
npm warn cleanup       path: 'C:\\Users\\bbert\\Desktop\\BeeSwarmv2-main\\node_modules\\@grpc\\grpc-js\\build'
npm warn cleanup     }
npm warn cleanup   ],
npm warn cleanup   [
npm warn cleanup     'C:\\Users\\bbert\\Desktop\\BeeSwarmv2-main\\node_modules\\netlify-cli\\node_modules\\require-in-the-middle',
npm warn cleanup     [Error: EPERM: operation not permitted, rmdir 'C:\Users\bbert\Desktop\BeeSwarmv2-main\node_modules\netlify-cli\node_modules\require-in-the-middle'] {        
npm warn cleanup       errno: -4048,
npm warn cleanup       code: 'EPERM',
npm warn cleanup       syscall: 'rmdir',
npm warn cleanup       path: 'C:\\Users\\bbert\\Desktop\\BeeSwarmv2-main\\node_modules\\netlify-cli\\node_modules\\require-in-the-middle'
npm warn cleanup     }
npm warn cleanup   ]
npm warn cleanup ]
npm error code 1
npm error path C:\Users\bbert\Desktop\BeeSwarmv2-main\node_modules\node-pty
npm error command failed
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c node-gyp rebuild
npm error gyp info it worked if it ends with ok
npm error gyp info using node-gyp@11.5.0
npm error gyp info using node@20.17.0 | win32 | x64
npm error gyp info find Python using Python version 3.12.2 found at "C:\Users\bbert\AppData\Local\Programs\Python\Python312\python.exe"
npm error gyp http GET https://nodejs.org/download/release/v20.17.0/node-v20.17.0-headers.tar.gz
npm error gyp http 200 https://nodejs.org/download/release/v20.17.0/node-v20.17.0-headers.tar.gz
npm error gyp http GET https://nodejs.org/download/release/v20.17.0/SHASUMS256.txt
npm error gyp http GET https://nodejs.org/download/release/v20.17.0/win-x64/node.lib
npm error gyp http 200 https://nodejs.org/download/release/v20.17.0/SHASUMS256.txt
npm error gyp http 200 https://nodejs.org/download/release/v20.17.0/win-x64/node.lib
npm error gyp ERR! find VS
npm error gyp ERR! find VS msvs_version not set from command line or npm config
npm error gyp ERR! find VS VCINSTALLDIR not set, not running in VS Command Prompt
npm error gyp ERR! find VS could not use PowerShell to find Visual Studio 2017 or newer, try re-running with '--loglevel silly' for more details.
npm error gyp ERR! find VS
npm error gyp ERR! find VS Failure details: undefined
npm error gyp ERR! find VS checking VS2019 (16.11.34601.136) found at:
npm error gyp ERR! find VS "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools"
npm error gyp ERR! find VS - found "Visual Studio C++ core features"
npm error gyp ERR! find VS - found VC++ toolset: v142
npm error gyp ERR! find VS - missing any Windows SDK
npm error gyp ERR! find VS could not find a version of Visual Studio 2017 or newer to use
npm error gyp ERR! find VS could not use PowerShell to find Visual Studio 2017 or newer, try re-running with '--loglevel silly' for more details.
npm error gyp ERR! find VS
npm error gyp ERR! find VS Failure details: undefined
npm error gyp ERR! find VS unsupported version "16.11.34601.136" found at "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools"
npm error gyp ERR! find VS could not find a version of Visual Studio 2017 or newer to use
npm error gyp ERR! find VS not looking for VS2015 as it is only supported up to Node.js 18
npm error gyp ERR! find VS not looking for VS2013 as it is only supported up to Node.js 8
npm error gyp ERR! find VS
npm error gyp ERR! find VS **************************************************************
npm error gyp ERR! find VS You need to install the latest version of Visual Studio
npm error gyp ERR! find VS including the "Desktop development with C++" workload.
npm error gyp ERR! find VS For more information consult the documentation at:
npm error gyp ERR! find VS https://github.com/nodejs/node-gyp#on-windows
npm error gyp ERR! find VS **************************************************************
npm error gyp ERR! find VS
npm error gyp ERR! configure error
npm error gyp ERR! stack Error: Could not find any Visual Studio installation to use
npm error gyp ERR! stack at VisualStudioFinder.fail (C:\Users\bbert\Desktop\BeeSwarmv2-main\node_modules\node-gyp\lib\find-visualstudio.js:118:11)
npm error gyp ERR! stack at VisualStudioFinder.findVisualStudio (C:\Users\bbert\Desktop\BeeSwarmv2-main\node_modules\node-gyp\lib\find-visualstudio.js:74:17)
npm error gyp ERR! stack at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
npm error gyp ERR! stack at async createBuildDir (C:\Users\bbert\Desktop\BeeSwarmv2-main\node_modules\node-gyp\lib\configure.js:112:18)
npm error gyp ERR! stack at async run (C:\Users\bbert\Desktop\BeeSwarmv2-main\node_modules\node-gyp\bin\node-gyp.js:81:18)
npm error gyp ERR! System Windows_NT 10.0.26100
npm error gyp ERR! command "C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\bbert\\Desktop\\BeeSwarmv2-main\\node_modules\\node-gyp\\bin\\node-gyp.js" "rebuild"
npm error gyp ERR! cwd C:\Users\bbert\Desktop\BeeSwarmv2-main\node_modules\node-pty
npm error gyp ERR! node -v v20.17.0
npm error gyp ERR! node-gyp -v v11.5.0
npm error gyp ERR! not ok
npm error A complete log of this run can be found in: C:\Users\bbert\AppData\Local\npm-cache\_logs\2025-12-11T02_11_28_507Z-debug-0.log
PS C:\Users\bbert\Desktop\BeeSwarmv2-main>