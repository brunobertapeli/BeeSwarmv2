import { ipcMain } from 'electron'
import { backendService } from '../services/BackendService.js'
import { databaseService } from '../services/DatabaseService.js'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

// Helper to download image from URL
function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// Helper to get assets folder from project
function getAssetsFolder(project: { path: string; imagePath: string | null }): string {
  let assetsFolder = 'public/assets' // default fallback
  if (project.imagePath) {
    assetsFolder = path.dirname(project.imagePath)
  }
  return path.join(project.path, assetsFolder)
}

export function registerBackgroundRemoverHandlers(): void {
  // Remove background from image
  ipcMain.handle('backgroundRemover:remove', async (
    _event,
    imageBase64: string,
    projectId: string
  ) => {
    try {
      // Get project to determine correct assets path
      const project = databaseService.getProjectById(projectId)
      if (!project || !project.path) {
        throw new Error('Project not found')
      }

      const result = await backendService.removeBackground(imageBase64)

      if (result.success && result.imageUrl) {
        // Download image directly from Replicate URL (much faster than going through backend)
        const imageBuffer = await downloadImage(result.imageUrl)

        // Save to assets/generations folder using project's imagePath
        const genDir = path.join(getAssetsFolder(project), 'generations')
        if (!fs.existsSync(genDir)) {
          fs.mkdirSync(genDir, { recursive: true })
        }

        const filename = `bg_removed_${Date.now()}.png`
        const filePath = path.join(genDir, filename)
        fs.writeFileSync(filePath, imageBuffer)

        // Convert to base64 for display
        const base64 = imageBuffer.toString('base64')

        return {
          success: true,
          imageDataUrl: `data:image/png;base64,${base64}`,
          localPath: filePath,
          usage: result.usage
        }
      }

      return result
    } catch (error: any) {
      return { success: false, error: error.message || 'Background removal failed' }
    }
  })

  // Save image state to database
  ipcMain.handle('backgroundRemover:saveState', async (
    _event,
    projectId: string,
    state: { inputImagePath: string | null; inputImageName: string | null; resultImagePath: string | null }
  ) => {
    try {
      databaseService.saveBgRemoverImageState(projectId, state)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Load image state from database
  ipcMain.handle('backgroundRemover:loadState', async (
    _event,
    projectId: string
  ) => {
    try {
      const state = databaseService.getBgRemoverImageState(projectId)
      return { success: true, state }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
