import { ipcMain, shell } from 'electron';

/**
 * Register shell-related IPC handlers
 */
export function registerShellHandlers(): void {
  // Open external URL in default browser
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
    } catch (error) {
      console.error('Failed to open external URL:', error);
      throw error;
    }
  });

  // Open path in default application
  ipcMain.handle('shell:open-path', async (_event, path: string) => {
    try {
      const error = await shell.openPath(path)
      return error || '' // Returns empty string on success, error message on failure
    } catch (error) {
      console.error('❌ Error opening path:', error)
      return error instanceof Error ? error.message : 'Failed to open path'
    }
  })

  // Show item in file explorer/finder
  ipcMain.handle('shell:show-item-in-folder', async (_event, path: string) => {
    try {
      shell.showItemInFolder(path)
    } catch (error) {
      console.error('❌ Error showing item in folder:', error)
      throw error
    }
  })
}
