import { ipcMain } from 'electron'
import { backendService } from '../services/BackendService'

export function registerTemplateHandlers() {
  // Fetch all templates
  ipcMain.handle('templates:fetch', async () => {
    try {
      const templates = await backendService.getTemplates()

      return {
        success: true,
        templates
      }
    } catch (error) {
      console.error('❌ Error fetching templates:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch templates'
      }
    }
  })

  // Get template by ID
  ipcMain.handle('templates:get-by-id', async (_event, templateId: string) => {
    try {
      const template = await backendService.getTemplateById(templateId)

      if (!template) {
        return {
          success: false,
          error: 'Template not found'
        }
      }

      return {
        success: true,
        template
      }
    } catch (error) {
      console.error('❌ Error fetching template:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch template'
      }
    }
  })
}
