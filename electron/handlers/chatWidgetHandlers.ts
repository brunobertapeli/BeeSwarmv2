import { ipcMain, WebContents } from 'electron'
import { backendService } from '../services/BackendService'
import { databaseService, ChatWidgetMessage } from '../services/DatabaseService'
import fs from 'fs'
import path from 'path'

let mainWindowContents: WebContents | null = null

export function setChatWidgetWindow(webContents: WebContents): void {
  mainWindowContents = webContents
}

export function registerChatWidgetHandlers(): void {
  // Get available AI models
  ipcMain.handle('chatWidget:get-models', async () => {
    try {
      const models = await backendService.getAIModels()
      return { success: true, models }
    } catch (error: any) {
      console.error('Failed to fetch AI models:', error)
      return { success: false, error: error.message || 'Failed to fetch models' }
    }
  })

  // Get AI usage stats
  ipcMain.handle('chatWidget:get-usage', async () => {
    try {
      const usage = await backendService.getAIUsage()
      return { success: true, ...usage }
    } catch (error: any) {
      console.error('Failed to fetch AI usage:', error)
      return { success: false, error: error.message || 'Failed to fetch usage' }
    }
  })

  // Chat completion with streaming
  ipcMain.handle('chatWidget:chat', async (
    _event,
    messages: Array<{ role: string; content: string }>,
    model: string
  ) => {
    return new Promise((resolve) => {
      try {
        backendService.streamChat(
          messages,
          model,
          // On chunk
          (chunk: string) => {
            if (mainWindowContents && !mainWindowContents.isDestroyed()) {
              mainWindowContents.send('chatWidget:stream-chunk', chunk)
            }
          },
          // On done
          (usage: any) => {
            if (mainWindowContents && !mainWindowContents.isDestroyed()) {
              mainWindowContents.send('chatWidget:stream-done', usage)
            }
            resolve({ success: true, usage })
          },
          // On error
          (error: Error) => {
            if (mainWindowContents && !mainWindowContents.isDestroyed()) {
              mainWindowContents.send('chatWidget:stream-error', error.message)
            }
            resolve({ success: false, error: error.message })
          }
        )
      } catch (error: any) {
        console.error('Chat error:', error)
        resolve({ success: false, error: error.message || 'Chat failed' })
      }
    })
  })

  // Image generation
  ipcMain.handle('chatWidget:generate-image', async (
    _event,
    projectId: string,
    prompt: string,
    size?: string
  ) => {
    try {
      const result = await backendService.generateImage(prompt, size)

      // Get project to determine correct assets path
      const project = databaseService.getProjectById(projectId)
      if (!project || !project.path) {
        throw new Error('Project not found')
      }

      // Use imagePath to determine assets folder (e.g., "frontend/public/assets/images" -> "frontend/public/assets")
      let assetsFolder = 'public/assets' // default fallback
      if (project.imagePath) {
        assetsFolder = path.dirname(project.imagePath)
      }

      // Save image to assets/generations folder
      const genDir = path.join(project.path, assetsFolder, 'generations')
      if (!fs.existsSync(genDir)) {
        fs.mkdirSync(genDir, { recursive: true })
      }

      const filename = `image_${Date.now()}.png`
      const filePath = path.join(genDir, filename)

      // Write base64 to file
      const imageBuffer = Buffer.from(result.image, 'base64')
      fs.writeFileSync(filePath, imageBuffer)

      // Return base64 data URL for display (Electron blocks file:// URLs)
      const base64DataUrl = `data:image/png;base64,${result.image}`

      return {
        success: true,
        localPath: filePath,
        filePath,
        imageDataUrl: base64DataUrl, // For displaying in renderer
        usage: result.usage
      }
    } catch (error: any) {
      console.error('Image generation error:', error)
      return { success: false, error: error.message || 'Image generation failed' }
    }
  })

  // ==================== Conversation Persistence ====================

  // Get all conversations for a project
  ipcMain.handle('chatWidget:get-conversations', async (_event, projectId: string) => {
    try {
      const conversations = databaseService.getChatWidgetConversations(projectId)
      return { success: true, conversations }
    } catch (error: any) {
      console.error('Failed to get conversations:', error)
      return { success: false, error: error.message || 'Failed to get conversations' }
    }
  })

  // Create a new conversation
  ipcMain.handle('chatWidget:create-conversation', async (
    _event,
    projectId: string,
    title: string,
    messages: ChatWidgetMessage[],
    modelCategory: 'chat' | 'images',
    model: string
  ) => {
    try {
      const conversation = databaseService.createChatWidgetConversation(
        projectId,
        title,
        modelCategory,
        model,
        messages
      )
      return { success: true, conversation }
    } catch (error: any) {
      console.error('Failed to create conversation:', error)
      return { success: false, error: error.message || 'Failed to create conversation' }
    }
  })

  // Update a conversation (add messages, update title)
  ipcMain.handle('chatWidget:update-conversation', async (
    _event,
    conversationId: string,
    title: string,
    messages: ChatWidgetMessage[]
  ) => {
    try {
      databaseService.updateChatWidgetConversation(conversationId, { title, messages })
      return { success: true }
    } catch (error: any) {
      console.error('Failed to update conversation:', error)
      return { success: false, error: error.message || 'Failed to update conversation' }
    }
  })

  // Delete a conversation
  ipcMain.handle('chatWidget:delete-conversation', async (_event, conversationId: string) => {
    try {
      databaseService.deleteChatWidgetConversation(conversationId)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to delete conversation:', error)
      return { success: false, error: error.message || 'Failed to delete conversation' }
    }
  })
}
