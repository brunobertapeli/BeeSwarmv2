/**
 * Download Git and GitHub CLI binaries for all supported platforms
 * Run with: node scripts/download-git.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GH_VERSION = '2.63.2';
const GIT_VERSION = '2.47.1';

const RESOURCES_DIR = path.join(__dirname, '..', 'resources', 'binaries');

const PLATFORMS = [
  {
    platform: 'darwin-arm64',
    gh: `gh_${GH_VERSION}_macOS_arm64.zip`,
    ghUrl: `https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_macOS_arm64.zip`,
    // Git for macOS - using git-scm binary installer extracted
    git: null, // Will handle separately
  },
  {
    platform: 'darwin-x64',
    gh: `gh_${GH_VERSION}_macOS_amd64.zip`,
    ghUrl: `https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_macOS_amd64.zip`,
    git: null,
  },
  {
    platform: 'linux-x64',
    gh: `gh_${GH_VERSION}_linux_amd64.tar.gz`,
    ghUrl: `https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz`,
    git: `git-${GIT_VERSION}-linux-x64.tar.gz`,
    gitUrl: null, // Linux git usually from package manager, we'll skip
  },
  {
    platform: 'win32-x64',
    gh: `gh_${GH_VERSION}_windows_amd64.zip`,
    ghUrl: `https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_windows_amd64.zip`,
    git: `PortableGit-${GIT_VERSION}-64-bit.7z.exe`,
    gitUrl: `https://github.com/git-for-windows/git/releases/download/v${GIT_VERSION}.windows.1/PortableGit-${GIT_VERSION}-64-bit.7z.exe`,
  },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`  Downloading: ${path.basename(dest)}`);

    const makeRequest = (requestUrl) => {
      const protocol = requestUrl.startsWith('https') ? https : require('http');

      protocol.get(requestUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          makeRequest(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(dest);
        const total = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;

        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (total) {
            const percent = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(`\r    Progress: ${percent}%`);
          }
        });

        response.pipe(file);
        file.on('finish', () => {
          console.log(' Done!');
          file.close(resolve);
        });
      }).on('error', reject);
    };

    makeRequest(url);
  });
}

async function extractGh(archivePath, platformDir, isZip) {
  const tempDir = path.join(RESOURCES_DIR, 'temp-gh');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  console.log(`  Extracting gh...`);

  if (isZip) {
    execSync(`unzip -o -q "${archivePath}" -d "${tempDir}"`, { stdio: 'pipe' });
  } else {
    execSync(`tar -xzf "${archivePath}" -C "${tempDir}"`, { stdio: 'pipe' });
  }

  // Find the gh binary
  const extracted = fs.readdirSync(tempDir).find(f => f.startsWith('gh_'));
  const ghBinSrc = path.join(tempDir, extracted, 'bin', 'gh');
  const ghBinDest = path.join(platformDir, 'gh');

  fs.copyFileSync(ghBinSrc, ghBinDest);
  fs.chmodSync(ghBinDest, 0o755);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
  fs.unlinkSync(archivePath);

  console.log(`  ✓ gh installed`);
}

async function extractGhWindows(archivePath, platformDir) {
  const tempDir = path.join(RESOURCES_DIR, 'temp-gh');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  console.log(`  Extracting gh...`);

  execSync(`unzip -o -q "${archivePath}" -d "${tempDir}"`, { stdio: 'pipe' });

  // Find the gh binary
  const extracted = fs.readdirSync(tempDir).find(f => f.startsWith('gh_'));
  const ghBinSrc = path.join(tempDir, extracted, 'bin', 'gh.exe');
  const ghBinDest = path.join(platformDir, 'gh.exe');

  fs.copyFileSync(ghBinSrc, ghBinDest);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
  fs.unlinkSync(archivePath);

  console.log(`  ✓ gh installed`);
}

async function downloadGitMacOS(platformDir, arch) {
  // For macOS, we'll create a wrapper that checks for system git first
  // If not found, prompt user to install Xcode Command Line Tools
  // This is because there's no easy portable Git for macOS

  console.log(`  Note: macOS Git uses system git or Xcode Command Line Tools`);
  console.log(`  Creating git wrapper script...`);

  // Create a wrapper script that uses system git
  const gitWrapper = `#!/bin/sh
# Git wrapper for CodeDeck
# Uses system git if available, otherwise prompts for Xcode CLT

if command -v /usr/bin/git &> /dev/null; then
    exec /usr/bin/git "$@"
elif command -v git &> /dev/null; then
    exec git "$@"
else
    echo "Git not found. Please install Xcode Command Line Tools:"
    echo "  xcode-select --install"
    exit 1
fi
`;

  fs.writeFileSync(path.join(platformDir, 'git'), gitWrapper);
  fs.chmodSync(path.join(platformDir, 'git'), 0o755);

  console.log(`  ✓ git wrapper created (uses system git)`);
}

async function downloadGitWindows(platformDir) {
  const gitUrl = `https://github.com/git-for-windows/git/releases/download/v${GIT_VERSION}.windows.1/MinGit-${GIT_VERSION}-64-bit.zip`;
  const archivePath = path.join(RESOURCES_DIR, 'mingit.zip');

  await downloadFile(gitUrl, archivePath);

  const gitDir = path.join(platformDir, 'git');
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true });
  }
  fs.mkdirSync(gitDir, { recursive: true });

  console.log(`  Extracting git...`);
  execSync(`unzip -o -q "${archivePath}" -d "${gitDir}"`, { stdio: 'pipe' });

  // Create wrapper batch file
  const gitBat = `@echo off\n"%~dp0git\\cmd\\git.exe" %*`;
  fs.writeFileSync(path.join(platformDir, 'git.cmd'), gitBat);

  fs.unlinkSync(archivePath);
  console.log(`  ✓ git installed`);
}

async function downloadGitLinux(platformDir) {
  // For Linux, create wrapper similar to macOS
  console.log(`  Note: Linux Git uses system git`);
  console.log(`  Creating git wrapper script...`);

  const gitWrapper = `#!/bin/sh
# Git wrapper for CodeDeck
if command -v git &> /dev/null; then
    exec git "$@"
else
    echo "Git not found. Please install git:"
    echo "  Ubuntu/Debian: sudo apt install git"
    echo "  Fedora: sudo dnf install git"
    exit 1
fi
`;

  fs.writeFileSync(path.join(platformDir, 'git'), gitWrapper);
  fs.chmodSync(path.join(platformDir, 'git'), 0o755);

  console.log(`  ✓ git wrapper created (uses system git)`);
}

async function main() {
  console.log(`\nDownloading GitHub CLI v${GH_VERSION} and Git v${GIT_VERSION}\n`);

  for (const config of PLATFORMS) {
    console.log(`\n[${config.platform}]`);

    const platformDir = path.join(RESOURCES_DIR, config.platform);
    if (!fs.existsSync(platformDir)) {
      fs.mkdirSync(platformDir, { recursive: true });
    }

    // Check if already downloaded
    const isWindows = config.platform.startsWith('win');
    const ghExists = fs.existsSync(path.join(platformDir, isWindows ? 'gh.exe' : 'gh'));
    const gitExists = fs.existsSync(path.join(platformDir, isWindows ? 'git.cmd' : 'git'));

    // Download gh CLI
    if (!ghExists) {
      const archivePath = path.join(RESOURCES_DIR, config.gh);
      try {
        await downloadFile(config.ghUrl, archivePath);
        if (isWindows) {
          await extractGhWindows(archivePath, platformDir);
        } else {
          await extractGh(archivePath, platformDir, config.gh.endsWith('.zip'));
        }
      } catch (error) {
        console.error(`  Error downloading gh: ${error.message}`);
      }
    } else {
      console.log(`  gh already exists, skipping...`);
    }

    // Download/setup Git
    if (!gitExists) {
      try {
        if (config.platform === 'win32-x64') {
          await downloadGitWindows(platformDir);
        } else if (config.platform.startsWith('darwin')) {
          await downloadGitMacOS(platformDir, config.platform.includes('arm64') ? 'arm64' : 'x64');
        } else {
          await downloadGitLinux(platformDir);
        }
      } catch (error) {
        console.error(`  Error setting up git: ${error.message}`);
      }
    } else {
      console.log(`  git already exists, skipping...`);
    }
  }

  console.log(`\n✅ All platforms processed!`);
  console.log(`\nNote: macOS and Linux use system git with fallback prompts.`);
  console.log(`Windows includes MinGit (portable git).`);
}

main().catch(console.error);
