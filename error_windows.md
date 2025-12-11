npm error code 1
npm error path C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-pty
npm error command failed
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c node-gyp rebuild
npm error Building the projects in this solution one at a time. To enable parallel build, please add the "-m" switch.
npm error   Agent.cc
npm error   AgentCreateDesktop.cc
npm error   ConsoleFont.cc
npm error   ConsoleInput.cc
npm error   ConsoleInputReencoding.cc
npm error   ConsoleLine.cc
npm error   DebugShowInput.cc
npm error   DefaultInputMap.cc
npm error   EventLoop.cc
npm error   InputMap.cc
npm error   LargeConsoleRead.cc
npm error   NamedPipe.cc
npm error   Scraper.cc
npm error   Terminal.cc
npm error   Win32Console.cc
npm error   Win32ConsoleBuffer.cc
npm error   main.cc
npm error   BackgroundDesktop.cc
npm error   Buffer.cc
npm error   DebugClient.cc
npm error   GenRandom.cc
npm error   OwnedHandle.cc
npm error   StringUtil.cc
npm error   WindowsSecurity.cc
npm error   WindowsVersion.cc
npm error   WinptyAssert.cc
npm error   WinptyException.cc
npm error   WinptyVersion.cc
npm error   win_delay_load_hook.cc
npm error   Generating code
npm error   Previous IPDB not found, fall back to full compilation.
npm error C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-pty\deps\winpty\src\agent\Agent.cc(231): warning C4722: 'Agent::~Agent': destructor never returns, potential memory leak [C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-pty\build\deps\winpty\src\winpty-agent.vcxproj]
npm error   All 1772 functions were compiled because no usable IPDB/IOBJ from previous compilation was found.
npm error   Finished generating code
npm error   winpty-agent.vcxproj -> C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-pty\build\Release\\winpty-agent.exe
npm error   AgentLocation.cc
npm error   winpty.cc
npm error   BackgroundDesktop.cc
npm error   Buffer.cc
npm error   DebugClient.cc
npm error   GenRandom.cc
npm error   OwnedHandle.cc
npm error   StringUtil.cc
npm error   WindowsSecurity.cc
npm error   WindowsVersion.cc
npm error   WinptyAssert.cc
npm error   WinptyException.cc
npm error   WinptyVersion.cc
npm error   win_delay_load_hook.cc
npm error      Creating library C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-pty\build\Release\winpty.lib and object C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-pty\build\Release\winpty.exp
npm error   Generating code
npm error   Previous IPDB not found, fall back to full compilation.
npm error   All 1056 functions were compiled because no usable IPDB/IOBJ from previous compilation was found.
npm error   Finished generating code
npm error   winpty.vcxproj -> C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-pty\build\Release\\winpty.dll
npm error C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\MSBuild\Microsoft\VC\v160\Microsoft.CppBuild.targets(486,5): error MSB8040: Spectre-mitigated libraries are required for this project. Install them from the Visual Studio installer (Individual components tab) for any toolsets and architectures being used. Learn more: https://aka.ms/Ofhn4c [C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-pty\build\conpty.vcxproj]
npm error C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\MSBuild\Microsoft\VC\v160\Microsoft.CppBuild.targets(486,5): error MSB8040: Spectre-mitigated libraries are required for this project. Install them from the Visual Studio installer (Individual components tab) for any toolsets and architectures being used. Learn more: https://aka.ms/Ofhn4c [C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-pty\build\conpty_console_list.vcxproj]
npm error C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\MSBuild\Microsoft\VC\v160\Microsoft.CppBuild.targets(486,5): error MSB8040: Spectre-mitigated libraries are required for this project. Install them from the Visual Studio installer (Individual components tab) for any toolsets and architectures being used. Learn more: https://aka.ms/Ofhn4c [C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-pty\build\pty.vcxproj]
npm error gyp info it worked if it ends with ok
npm error gyp info using node-gyp@11.5.0
npm error gyp info using node@20.17.0 | win32 | x64
npm error gyp info find Python using Python version 3.12.2 found at "C:\Users\bbert\AppData\Local\Programs\Python\Python312\python.exe"
npm error gyp info find VS using VS2019 (16.11.36631.11) found at:
npm error gyp info find VS "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools"
npm error gyp info find VS run with --verbose for detailed information
npm error gyp info spawn C:\Users\bbert\AppData\Local\Programs\Python\Python312\python.exe
npm error gyp info spawn args [
npm error gyp info spawn args 'C:\\Users\\bbert\\Documents\\GitHub\\BeeSwarmv2\\node_modules\\node-gyp\\gyp\\gyp_main.py',
npm error gyp info spawn args 'binding.gyp',
npm error gyp info spawn args '-f',
npm error gyp info spawn args 'msvs',
npm error gyp info spawn args '-I',
npm error gyp info spawn args 'C:\\Users\\bbert\\Documents\\GitHub\\BeeSwarmv2\\node_modules\\node-pty\\build\\config.gypi',
npm error gyp info spawn args '-I',
npm error gyp info spawn args 'C:\\Users\\bbert\\Documents\\GitHub\\BeeSwarmv2\\node_modules\\node-gyp\\addon.gypi',
npm error gyp info spawn args '-I',
npm error gyp info spawn args 'C:\\Users\\bbert\\AppData\\Local\\node-gyp\\Cache\\20.17.0\\include\\node\\common.gypi',
npm error gyp info spawn args '-Dlibrary=shared_library',
npm error gyp info spawn args '-Dvisibility=default',
npm error gyp info spawn args '-Dnode_root_dir=C:\\Users\\bbert\\AppData\\Local\\node-gyp\\Cache\\20.17.0',
npm error gyp info spawn args '-Dnode_gyp_dir=C:\\Users\\bbert\\Documents\\GitHub\\BeeSwarmv2\\node_modules\\node-gyp',
npm error gyp info spawn args '-Dnode_lib_file=C:\\\\Users\\\\bbert\\\\AppData\\\\Local\\\\node-gyp\\\\Cache\\\\20.17.0\\\\<(target_arch)\\\\node.lib',
npm error gyp info spawn args '-Dmodule_root_dir=C:\\Users\\bbert\\Documents\\GitHub\\BeeSwarmv2\\node_modules\\node-pty',
npm error gyp info spawn args '-Dnode_engine=v8',
npm error gyp info spawn args '--depth=.',
npm error gyp info spawn args '--no-parallel',
npm error gyp info spawn args '--generator-output',
npm error gyp info spawn args 'C:\\Users\\bbert\\Documents\\GitHub\\BeeSwarmv2\\node_modules\\node-pty\\build',
npm error gyp info spawn args '-Goutput_dir=.'
npm error gyp info spawn args ]
npm error gyp info spawn C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\MSBuild\Current\Bin\MSBuild.exe
npm error gyp info spawn args [
npm error gyp info spawn args 'build/binding.sln',
npm error gyp info spawn args '/clp:Verbosity=minimal',
npm error gyp info spawn args '/nologo',
npm error gyp info spawn args '/nodeReuse:false',
npm error gyp info spawn args '/p:Configuration=Release;Platform=x64'
npm error gyp info spawn args ]
npm error gyp ERR! build error
npm error gyp ERR! stack Error: `C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\MSBuild\Current\Bin\MSBuild.exe` failed with exit code: 1       
npm error gyp ERR! stack at ChildProcess.<anonymous> (C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-gyp\lib\build.js:219:23)
npm error gyp ERR! stack at ChildProcess.emit (node:events:519:28)
npm error gyp ERR! stack at ChildProcess._handle.onexit (node:internal/child_process:294:12)
npm error gyp ERR! System Windows_NT 10.0.26100
npm error gyp ERR! command "C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\bbert\\Documents\\GitHub\\BeeSwarmv2\\node_modules\\node-gyp\\bin\\node-gyp.js" "rebuild"
npm error gyp ERR! cwd C:\Users\bbert\Documents\GitHub\BeeSwarmv2\node_modules\node-pty
npm error gyp ERR! node -v v20.17.0
npm error gyp ERR! node-gyp -v v11.5.0
npm error gyp ERR! not ok
npm error A complete log of this run can be found in: C:\Users\bbert\AppData\Local\npm-cache\_logs\2025-12-11T02_55_37_143Z-debug-0.log
PS C:\Users\bbert\Documents\GitHub\BeeSwarmv2>