/**
 * Download Node.js binaries for all supported platforms
 * Run with: node scripts/download-node.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NODE_VERSION = '22.12.0';
const RESOURCES_DIR = path.join(__dirname, '..', 'resources', 'binaries');

const PLATFORMS = [
  { platform: 'darwin-arm64', nodeFile: `node-v${NODE_VERSION}-darwin-arm64.tar.gz` },
  { platform: 'darwin-x64', nodeFile: `node-v${NODE_VERSION}-darwin-x64.tar.gz` },
  { platform: 'linux-x64', nodeFile: `node-v${NODE_VERSION}-linux-x64.tar.gz` },
  { platform: 'win32-x64', nodeFile: `node-v${NODE_VERSION}-win-x64.zip` },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (res) => {
          const total = parseInt(res.headers['content-length'], 10);
          let downloaded = 0;

          res.on('data', (chunk) => {
            downloaded += chunk.length;
            const percent = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(`\r  Progress: ${percent}%`);
          });

          res.pipe(file);
          file.on('finish', () => {
            console.log(' Done!');
            file.close(resolve);
          });
        }).on('error', reject);
      } else {
        const total = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;

        response.on('data', (chunk) => {
          downloaded += chunk.length;
          const percent = ((downloaded / total) * 100).toFixed(1);
          process.stdout.write(`\r  Progress: ${percent}%`);
        });

        response.pipe(file);
        file.on('finish', () => {
          console.log(' Done!');
          file.close(resolve);
        });
      }
    }).on('error', reject);
  });
}

async function extractAndCopy(archivePath, platformDir, isWindows) {
  const tempDir = path.join(RESOURCES_DIR, 'temp');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  console.log(`  Extracting...`);

  if (isWindows) {
    // Use unzip for Windows .zip files
    execSync(`unzip -o -q "${archivePath}" -d "${tempDir}"`, { stdio: 'inherit' });
  } else {
    // Use tar for Unix .tar.gz files
    execSync(`tar -xzf "${archivePath}" -C "${tempDir}"`, { stdio: 'inherit' });
  }

  // Find the extracted directory
  const extracted = fs.readdirSync(tempDir).find(f => f.startsWith('node-'));
  const extractedPath = path.join(tempDir, extracted);

  // Copy node binary
  const nodeSrc = isWindows
    ? path.join(extractedPath, 'node.exe')
    : path.join(extractedPath, 'bin', 'node');
  const nodeDest = path.join(platformDir, isWindows ? 'node.exe' : 'node');

  console.log(`  Copying node binary...`);
  fs.copyFileSync(nodeSrc, nodeDest);
  if (!isWindows) {
    fs.chmodSync(nodeDest, 0o755);
  }

  // Copy npm files
  const npmDir = isWindows
    ? path.join(extractedPath, 'node_modules', 'npm')
    : path.join(extractedPath, 'lib', 'node_modules', 'npm');
  const npmDestDir = path.join(platformDir, 'npm');

  console.log(`  Copying npm...`);

  // Remove existing npm dir if exists
  if (fs.existsSync(npmDestDir)) {
    fs.rmSync(npmDestDir, { recursive: true });
  }

  // Copy npm module
  execSync(`cp -r "${npmDir}" "${npmDestDir}"`, { stdio: 'inherit' });

  // Create npm/npx wrapper scripts
  if (isWindows) {
    // Windows batch files
    const npmBat = `@echo off\n"%~dp0node.exe" "%~dp0npm\\bin\\npm-cli.js" %*`;
    fs.writeFileSync(path.join(platformDir, 'npm-cli.cmd'), npmBat);

    const npxBat = `@echo off\n"%~dp0node.exe" "%~dp0npm\\bin\\npx-cli.js" %*`;
    fs.writeFileSync(path.join(platformDir, 'npx-cli.cmd'), npxBat);
  } else {
    // Unix shell scripts
    const npmSh = `#!/bin/sh\nDIR="$(cd "$(dirname "$0")" && pwd)"\nexec "$DIR/node" "$DIR/npm/bin/npm-cli.js" "$@"`;
    fs.writeFileSync(path.join(platformDir, 'npm-cli'), npmSh);
    fs.chmodSync(path.join(platformDir, 'npm-cli'), 0o755);

    const npxSh = `#!/bin/sh\nDIR="$(cd "$(dirname "$0")" && pwd)"\nexec "$DIR/node" "$DIR/npm/bin/npx-cli.js" "$@"`;
    fs.writeFileSync(path.join(platformDir, 'npx-cli'), npxSh);
    fs.chmodSync(path.join(platformDir, 'npx-cli'), 0o755);
  }

  // Cleanup
  console.log(`  Cleaning up...`);
  fs.rmSync(tempDir, { recursive: true });
  fs.unlinkSync(archivePath);
}

async function main() {
  console.log(`\nDownloading Node.js v${NODE_VERSION} for all platforms\n`);

  for (const { platform, nodeFile } of PLATFORMS) {
    console.log(`\n[${platform}]`);

    const platformDir = path.join(RESOURCES_DIR, platform);
    if (!fs.existsSync(platformDir)) {
      fs.mkdirSync(platformDir, { recursive: true });
    }

    // Check if already downloaded
    const nodeExists = fs.existsSync(path.join(platformDir, platform.startsWith('win') ? 'node.exe' : 'node'));
    const npmCliExists = fs.existsSync(path.join(platformDir, platform.startsWith('win') ? 'npm-cli.cmd' : 'npm-cli'));

    if (nodeExists && npmCliExists) {
      console.log(`  Already exists, skipping...`);
      continue;
    }

    const url = `https://nodejs.org/dist/v${NODE_VERSION}/${nodeFile}`;
    const archivePath = path.join(RESOURCES_DIR, nodeFile);

    try {
      await downloadFile(url, archivePath);
      await extractAndCopy(archivePath, platformDir, platform.startsWith('win'));
      console.log(`  Done!`);
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
  }

  console.log(`\nAll platforms processed!`);
  console.log(`\nBinaries location: ${RESOURCES_DIR}`);
}

main().catch(console.error);
