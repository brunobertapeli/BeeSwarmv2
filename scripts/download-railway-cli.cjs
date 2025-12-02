/**
 * Download Railway CLI binaries for all platforms
 * Run with: node scripts/download-railway-cli.cjs
 */

const https = require('https')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const util = require('util')
const AdmZip = require('adm-zip')

const execPromise = util.promisify(exec)

const RAILWAY_VERSION = 'v4.12.0'
const BINARIES_DIR = path.join(__dirname, '../resources/binaries')

const platforms = [
  {
    name: 'win32-x64',
    url: `https://github.com/railwayapp/cli/releases/download/${RAILWAY_VERSION}/railway-${RAILWAY_VERSION}-x86_64-pc-windows-msvc.zip`,
    outputName: 'railway.exe',
    archiveType: 'zip'
  },
  {
    name: 'darwin-x64',
    url: `https://github.com/railwayapp/cli/releases/download/${RAILWAY_VERSION}/railway-${RAILWAY_VERSION}-x86_64-apple-darwin.tar.gz`,
    outputName: 'railway',
    archiveType: 'tar.gz'
  },
  {
    name: 'darwin-arm64',
    url: `https://github.com/railwayapp/cli/releases/download/${RAILWAY_VERSION}/railway-${RAILWAY_VERSION}-aarch64-apple-darwin.tar.gz`,
    outputName: 'railway',
    archiveType: 'tar.gz'
  },
  {
    name: 'linux-x64',
    url: `https://github.com/railwayapp/cli/releases/download/${RAILWAY_VERSION}/railway-${RAILWAY_VERSION}-x86_64-unknown-linux-gnu.tar.gz`,
    outputName: 'railway',
    archiveType: 'tar.gz'
  }
]

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const request = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          request(response.headers.location)
          return
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode} from ${url}`))
          return
        }

        const file = fs.createWriteStream(dest)
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
        file.on('error', (err) => {
          fs.unlink(dest, () => {})
          reject(err)
        })
      }).on('error', reject)
    }
    request(url)
  })
}

async function extractTarGz(archivePath, outputDir) {
  await execPromise(`tar -xzf "${archivePath}" -C "${outputDir}"`)
}

async function extractZip(archivePath, outputDir) {
  const zip = new AdmZip(archivePath)
  zip.extractAllTo(outputDir, true)
}

async function downloadBinaries() {
  console.log('='.repeat(60))
  console.log('Railway CLI Binary Downloader')
  console.log('='.repeat(60))
  console.log(`Version: ${RAILWAY_VERSION}`)
  console.log(`Output: ${BINARIES_DIR}`)
  console.log('')

  // Ensure directories exist
  for (const platform of platforms) {
    const platformDir = path.join(BINARIES_DIR, platform.name)
    if (!fs.existsSync(platformDir)) {
      fs.mkdirSync(platformDir, { recursive: true })
    }
  }

  for (const platform of platforms) {
    const platformDir = path.join(BINARIES_DIR, platform.name)
    const finalBinaryPath = path.join(platformDir, platform.outputName)

    // Check if already downloaded
    if (fs.existsSync(finalBinaryPath)) {
      console.log(`[SKIP] ${platform.name} - already exists`)
      continue
    }

    console.log(`[DOWNLOAD] ${platform.name}...`)
    console.log(`  URL: ${platform.url}`)

    try {
      const archiveExt = platform.archiveType === 'zip' ? '.zip' : '.tar.gz'
      const archivePath = path.join(platformDir, `railway${archiveExt}`)

      await downloadFile(platform.url, archivePath)

      console.log(`[EXTRACT] ${platform.name}...`)

      if (platform.archiveType === 'zip') {
        await extractZip(archivePath, platformDir)
      } else {
        await extractTarGz(archivePath, platformDir)
      }

      // Clean up archive
      fs.unlinkSync(archivePath)

      // Find and rename the extracted binary
      const files = fs.readdirSync(platformDir)
      const railwayFile = files.find(f =>
        f.startsWith('railway') &&
        !f.endsWith('.tar.gz') &&
        !f.endsWith('.zip')
      )

      if (railwayFile && railwayFile !== platform.outputName) {
        fs.renameSync(
          path.join(platformDir, railwayFile),
          finalBinaryPath
        )
      }

      // Make executable on Unix
      if (platform.name !== 'win32-x64') {
        fs.chmodSync(finalBinaryPath, '755')
      }

      console.log(`[OK] ${platform.name}`)
    } catch (error) {
      console.error(`[ERROR] ${platform.name}: ${error.message}`)
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('Done!')
  console.log('='.repeat(60))
}

// Run if called directly
if (require.main === module) {
  downloadBinaries().catch(error => {
    console.error('Failed:', error)
    process.exit(1)
  })
}

module.exports = { downloadBinaries }
