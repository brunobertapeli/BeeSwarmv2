✓ built in 34.52s
vite v5.4.21 building for production...
transforming...
"open" is imported from external module "fs/promises" but never used in "node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs".
✓ 111 modules transformed.
[plugin:vite:reporter] [plugin vite:reporter] 
(!) D:/a/BeeSwarmv2/BeeSwarmv2/electron/services/BundledBinaries.ts is dynamically imported by D:/a/BeeSwarmv2/BeeSwarmv2/electron/services/ProjectService.ts but also statically imported by D:/a/BeeSwarmv2/BeeSwarmv2/electron/handlers/gitHandlers.ts, D:/a/BeeSwarmv2/BeeSwarmv2/electron/services/ClaudeCliService.ts, D:/a/BeeSwarmv2/BeeSwarmv2/electron/services/DependencyService.ts, D:/a/BeeSwarmv2/BeeSwarmv2/electron/services/ProcessManager.ts, D:/a/BeeSwarmv2/BeeSwarmv2/electron/services/TemplateService.ts, dynamic import will not move module into another chunk.

[plugin:vite:reporter] [plugin vite:reporter] 
(!) D:/a/BeeSwarmv2/BeeSwarmv2/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs is dynamically imported by D:/a/BeeSwarmv2/BeeSwarmv2/electron/services/ClaudeCliService.ts but also statically imported by D:/a/BeeSwarmv2/BeeSwarmv2/electron/services/ClaudeService.ts, D:/a/BeeSwarmv2/BeeSwarmv2/electron/services/ResearchAgentService.ts, dynamic import will not move module into another chunk.

rendering chunks...
computing gzip size...
dist-electron/main.js  821.24 kB │ gzip: 180.36 kB
✓ built in 1.50s
  • electron-builder  version=24.13.3 os=10.0.26100
  • artifacts will be published if draft release exists  reason=CI detected
  • loaded configuration  file=package.json ("build" field)
  • @electron/rebuild not required if you use electron-builder, please consider to remove excess dependency from devDependencies

To ensure your native dependencies are always matched electron version, simply add script `"postinstall": "electron-builder install-app-deps" to your `package.json`
  • rebuilding native dependencies  dependencies=better-sqlite3@12.5.0, canvas@3.2.0, node-pty@1.0.0, canvas@2.11.2, @parcel/watcher@2.5.1, unix-dgram@2.0.7 platform=win32 arch=x64
  • install prebuilt binary  name=better-sqlite3 version=12.5.0 platform=win32 arch=x64 napi=
  • install prebuilt binary  name=canvas version=3.2.0 platform=win32 arch=x64 napi= 
  ⨯ cannot execute  cause=exit status 1
                    errorOut=npm error code 1
    npm error path D:\a\BeeSwarmv2\BeeSwarmv2\node_modules\fabric\node_modules\canvas
    npm error command failed
    npm error command C:\Windows\system32\cmd.exe /d /s /c node-pre-gyp install --fallback-to-build --update-binary
    npm error Warning: Missing input files:
    npm error C:\GTK\bin\libgobject-2.0-0.dll
    npm error C:\GTK\bin\libpangocairo-1.0-0.dll
    npm error C:\GTK\bin\zlib1.dll
    npm error C:\GTK\bin\libpangoft2-1.0-0.dll
    npm error C:\GTK\bin\libpango-1.0-0.dll
    npm error C:\GTK\bin\libfontconfig-1.dll
    npm error C:\GTK\bin\libexpat-1.dll
    npm error C:\GTK\bin\libgmodule-2.0-0.dll
    npm error C:\GTK\bin\libpangowin32-1.0-0.dll
    npm error C:\GTK\bin\libglib-2.0-0.dll
    npm error C:\GTK\bin\libintl-8.dll
    npm error C:\GTK\bin\libcairo-2.dll
    npm error C:\GTK\bin\libpng14-14.dll
    npm error C:\GTK\bin\libfreetype-6.dll
    npm error C:\GTK\bin\libgthread-2.0-0.dll
    npm error
    npm error   Backend.cc
    npm error D:\a\BeeSwarmv2\BeeSwarmv2\node_modules\fabric\node_modules\canvas\src\backend\Backend.h(3,10): error C1083: Cannot open include file: 'cairo.h': No such file or directory [D:\a\BeeSwarmv2\BeeSwarmv2\node_modules\fabric\node_modules\canvas\build\canvas.vcxproj]
    npm error   (compiling source file '../src/backend/Backend.cc')
    npm error   
    npm error Failed to execute 'C:\hostedtoolcache\windows\node\20.19.6\x64\node.exe C:\hostedtoolcache\windows\node\20.19.6\x64\node_modules\npm\node_modules\node-gyp\bin\node-gyp.js build --fallback-to-build --update-binary --module=D:\a\BeeSwarmv2\BeeSwarmv2\node_modules\fabric\node_modules\canvas\build\Release\canvas.node --module_name=canvas --module_path=D:\a\BeeSwarmv2\BeeSwarmv2\node_modules\fabric\node_modules\canvas\build\Release --napi_version=9 --node_abi_napi=napi --napi_build_version=0 --node_napi_label=electron-v38.7' (1)
    npm error node-pre-gyp info it worked if it ends with ok
    npm error node-pre-gyp info using node-pre-gyp@1.0.11
    npm error node-pre-gyp info using node@20.19.6 | win32 | x64
    npm error node-pre-gyp http GET https://github.com/Automattic/node-canvas/releases/download/v2.11.2/canvas-v2.11.2-electron-v38.7-win32-unknown-x64.tar.gz
    npm error node-pre-gyp ERR! install response status 404 Not Found on https://github.com/Automattic/node-canvas/releases/download/v2.11.2/canvas-v2.11.2-electron-v38.7-win32-unknown-x64.tar.gz 
    npm error node-pre-gyp WARN Pre-built binaries not installable for canvas@2.11.2 and electron@38.7.2 (electron-v38.7 ABI, unknown) (falling back to source compile with node-gyp) 
    npm error node-pre-gyp WARN Hit error response status 404 Not Found on https://github.com/Automattic/node-canvas/releases/download/v2.11.2/canvas-v2.11.2-electron-v38.7-win32-unknown-x64.tar.gz 
    npm error gyp info it worked if it ends with ok
    npm error gyp info using node-gyp@10.1.0
    npm error gyp info using node@20.19.6 | win32 | x64
    npm error gyp info ok 
    npm error gyp info it worked if it ends with ok
    npm error gyp info using node-gyp@10.1.0
    npm error gyp info using node@20.19.6 | win32 | x64
    npm error gyp info find Python using Python version 3.14.2 found at "C:\hostedtoolcache\windows\Python\3.14.2\x64\python.exe"
    npm error gyp http GET https://electronjs.org/headers/v38.7.2/node-v38.7.2-headers.tar.gz
    npm error gyp http 200 https://artifacts.electronjs.org/headers/dist/v38.7.2/node-v38.7.2-headers.tar.gz
    npm error gyp http GET https://electronjs.org/headers/v38.7.2/SHASUMS256.txt
    npm error gyp http GET https://electronjs.org/headers/v38.7.2/win-x64/node.lib
    npm error gyp http 200 https://artifacts.electronjs.org/headers/dist/v38.7.2/win-x64/node.lib
    npm error gyp http 200 https://artifacts.electronjs.org/headers/dist/v38.7.2/SHASUMS256.txt
    npm error gyp info find VS using VS2022 (17.14.36717.8) found at:
    npm error gyp info find VS "C:\Program Files\Microsoft Visual Studio\2022\Enterprise"
    npm error gyp info find VS run with --verbose for detailed information
    npm error gyp info spawn C:\hostedtoolcache\windows\Python\3.14.2\x64\python.exe
    npm error gyp info spawn args [
    npm error gyp info spawn args 'C:\\hostedtoolcache\\windows\\node\\20.19.6\\x64\\node_modules\\npm\\node_modules\\node-gyp\\gyp\\gyp_main.py',
    npm error gyp info spawn args 'binding.gyp',
    npm error gyp info spawn args '-f',
    npm error gyp info spawn args 'msvs',
    npm error gyp info spawn args '-I',
    npm error gyp info spawn args 'D:\\a\\BeeSwarmv2\\BeeSwarmv2\\node_modules\\fabric\\node_modules\\canvas\\build\\config.gypi',
    npm error gyp info spawn args '-I',
    npm error gyp info spawn args 'C:\\hostedtoolcache\\windows\\node\\20.19.6\\x64\\node_modules\\npm\\node_modules\\node-gyp\\addon.gypi',
    npm error gyp info spawn args '-I',
    npm error gyp info spawn args 'C:\\Users\\runneradmin\\.electron-gyp\\38.7.2\\include\\node\\common.gypi',
    npm error gyp info spawn args '-Dlibrary=shared_library',
    npm error gyp info spawn args '-Dvisibility=default',
    npm error gyp info spawn args '-Dnode_root_dir=C:\\Users\\runneradmin\\.electron-gyp\\38.7.2',
    npm error gyp info spawn args '-Dnode_gyp_dir=C:\\hostedtoolcache\\windows\\node\\20.19.6\\x64\\node_modules\\npm\\node_modules\\node-gyp',
    npm error gyp info spawn args '-Dnode_lib_file=C:\\\\Users\\\\runneradmin\\\\.electron-gyp\\\\38.7.2\\\\<(target_arch)\\\\node.lib',
    npm error gyp info spawn args '-Dmodule_root_dir=D:\\a\\BeeSwarmv2\\BeeSwarmv2\\node_modules\\fabric\\node_modules\\canvas',
    npm error gyp info spawn args '-Dnode_engine=v8',
    npm error gyp info spawn args '--depth=.',
    npm error gyp info spawn args '--no-parallel',
    npm error gyp info spawn args '--generator-output',
    npm error gyp info spawn args 'D:\\a\\BeeSwarmv2\\BeeSwarmv2\\node_modules\\fabric\\node_modules\\canvas\\build',
    npm error gyp info spawn args '-Goutput_dir=.'
    npm error gyp info spawn args ]
    npm error gyp info ok 
    npm error gyp info it worked if it ends with ok
    npm error gyp info using node-gyp@10.1.0
    npm error gyp info using node@20.19.6 | win32 | x64
    npm error gyp info spawn C:\Program Files\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe
    npm error gyp info spawn args [
    npm error gyp info spawn args 'build\\binding.sln',
    npm error gyp info spawn args '/clp:Verbosity=minimal',
    npm error gyp info spawn args '/nologo',
    npm error gyp info spawn args '/p:Configuration=Release;Platform=x64'
    npm error gyp info spawn args ]
    npm error gyp ERR! build error 
    npm error gyp ERR! stack Error: `C:\Program Files\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe` failed with exit code: 1
    npm error gyp ERR! stack at ChildProcess.<anonymous> (C:\hostedtoolcache\windows\node\20.19.6\x64\node_modules\npm\node_modules\node-gyp\lib\build.js:209:23)
    npm error gyp ERR! stack at ChildProcess.emit (node:events:524:28)
    npm error gyp ERR! stack at ChildProcess._handle.onexit (node:internal/child_process:293:12)
    npm error gyp ERR! System Windows_NT 10.0.26100
    npm error gyp ERR! command "C:\\hostedtoolcache\\windows\\node\\20.19.6\\x64\\node.exe" "C:\\hostedtoolcache\\windows\\node\\20.19.6\\x64\\node_modules\\npm\\node_modules\\node-gyp\\bin\\node-gyp.js" "build" "--fallback-to-build" "--update-binary" "--module=D:\\a\\BeeSwarmv2\\BeeSwarmv2\\node_modules\\fabric\\node_modules\\canvas\\build\\Release\\canvas.node" "--module_name=canvas" "--module_path=D:\\a\\BeeSwarmv2\\BeeSwarmv2\\node_modules\\fabric\\node_modules\\canvas\\build\\Release" "--napi_version=9" "--node_abi_napi=napi" "--napi_build_version=0" "--node_napi_label=electron-v38.7"
    npm error gyp ERR! cwd D:\a\BeeSwarmv2\BeeSwarmv2\node_modules\fabric\node_modules\canvas
    npm error gyp ERR! node -v v20.19.6
    npm error gyp ERR! node-gyp -v v10.1.0
    npm error gyp ERR! not ok 
    npm error node-pre-gyp ERR! build error 
    npm error node-pre-gyp ERR! stack Error: Failed to execute 'C:\hostedtoolcache\windows\node\20.19.6\x64\node.exe C:\hostedtoolcache\windows\node\20.19.6\x64\node_modules\npm\node_modules\node-gyp\bin\node-gyp.js build --fallback-to-build --update-binary --module=D:\a\BeeSwarmv2\BeeSwarmv2\node_modules\fabric\node_modules\canvas\build\Release\canvas.node --module_name=canvas --module_path=D:\a\BeeSwarmv2\BeeSwarmv2\node_modules\fabric\node_modules\canvas\build\Release --napi_version=9 --node_abi_napi=napi --napi_build_version=0 --node_napi_label=electron-v38.7' (1)
    npm error node-pre-gyp ERR! stack     at ChildProcess.<anonymous> (D:\a\BeeSwarmv2\BeeSwarmv2\node_modules\fabric\node_modules\@mapbox\node-pre-gyp\lib\util\compile.js:89:23)
    npm error node-pre-gyp ERR! stack     at ChildProcess.emit (node:events:524:28)
    npm error node-pre-gyp ERR! stack     at maybeClose (node:internal/child_process:1104:16)
    npm error node-pre-gyp ERR! stack     at ChildProcess._handle.onexit (node:internal/child_process:304:5)
    npm error node-pre-gyp ERR! System Windows_NT 10.0.26100
    npm error node-pre-gyp ERR! command "C:\\hostedtoolcache\\windows\\node\\20.19.6\\x64\\node.exe" "D:\\a\\BeeSwarmv2\\BeeSwarmv2\\node_modules\\fabric\\node_modules\\@mapbox\\node-pre-gyp\\bin\\node-pre-gyp" "install" "--fallback-to-build" "--update-binary"
    npm error node-pre-gyp ERR! cwd D:\a\BeeSwarmv2\BeeSwarmv2\node_modules\fabric\node_modules\canvas
    npm error node-pre-gyp ERR! node -v v20.19.6
    npm error node-pre-gyp ERR! node-pre-gyp -v v1.0.11
    npm error node-pre-gyp ERR! not ok
    npm error A complete log of this run can be found in: C:\npm\cache\_logs\2025-12-10T21_21_24_741Z-debug-0.log
    
                    command='C:\hostedtoolcache\windows\node\20.19.6\x64\node.exe' 'C:\hostedtoolcache\windows\node\20.19.6\x64\node_modules\npm\bin\npm-cli.js' rebuild node-pty@1.0.0 canvas@2.11.2 @parcel/watcher@2.5.1 unix-dgram@2.0.7
                    workingDir=
Error: Process completed with exit code 1.