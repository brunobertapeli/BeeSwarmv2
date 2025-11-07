import { ipcMain, safeStorage } from 'electron'

export function registerSecureStorageHandlers() {
  // Store encrypted data
  ipcMain.handle('secure-storage:set', async (event, key: string, value: string) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn('⚠️  Encryption not available, falling back to base64')
        // Fallback for Linux systems without keyring
        const encoded = Buffer.from(value).toString('base64')
        return { success: true, encrypted: encoded, fallback: true }
      }

      const buffer = safeStorage.encryptString(value)
      const encrypted = buffer.toString('base64')

      return { success: true, encrypted }
    } catch (error: any) {
      console.error('Error encrypting data:', error)
      return { success: false, error: error.message }
    }
  })

  // Retrieve and decrypt data
  ipcMain.handle('secure-storage:get', async (event, encrypted: string, isFallback?: boolean) => {
    try {
      if (isFallback) {
        // Decode fallback data
        const decoded = Buffer.from(encrypted, 'base64').toString('utf-8')
        return { success: true, value: decoded }
      }

      // Always try to decrypt, even if isEncryptionAvailable() returns false
      // The keychain might still work even if the check returns false
      try {
        const buffer = Buffer.from(encrypted, 'base64')
        const decrypted = safeStorage.decryptString(buffer)
        return { success: true, value: decrypted }
      } catch (decryptError: any) {
        // If decryption fails and encryption isn't available, provide helpful error
        if (!safeStorage.isEncryptionAvailable()) {
          return { success: false, error: 'Encryption not available for decryption' }
        }
        // Otherwise, throw the error to be caught by outer catch
        throw decryptError
      }
    } catch (error: any) {
      console.error('Error decrypting data:', error)
      return { success: false, error: error.message }
    }
  })

  // Check if encryption is available
  ipcMain.handle('secure-storage:is-available', async () => {
    return { success: true, available: safeStorage.isEncryptionAvailable() }
  })
}
