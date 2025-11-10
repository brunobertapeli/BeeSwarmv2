import fs from 'fs'
import path from 'path'

/**
 * Service for managing .env files in project directories
 */
class EnvService {
  /**
   * Write environment variables to .env file
   * @param projectPath - Absolute path to project directory
   * @param envVars - Object with key-value pairs to write
   * @param fileName - Name of env file (default: .env)
   */
  writeEnvFile(
    projectPath: string,
    envVars: Record<string, string>,
    fileName: string = '.env'
  ): void {
    try {
      const envFilePath = path.join(projectPath, fileName)

      // Format as .env file
      const content = Object.entries(envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')

      // Write to file
      fs.writeFileSync(envFilePath, content + '\n', 'utf-8')

    } catch (error) {
      console.error('❌ Failed to write .env file:', error)
      throw error
    }
  }

  /**
   * Read environment variables from .env file
   * @param projectPath - Absolute path to project directory
   * @param fileName - Name of env file (default: .env)
   * @returns Object with key-value pairs
   */
  readEnvFile(projectPath: string, fileName: string = '.env'): Record<string, string> {
    try {
      const envFilePath = path.join(projectPath, fileName)

      // Check if file exists
      if (!fs.existsSync(envFilePath)) {
        return {}
      }

      // Read file
      const content = fs.readFileSync(envFilePath, 'utf-8')

      // Parse into object
      const envVars: Record<string, string> = {}
      content.split('\n').forEach(line => {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=')
          if (key) {
            envVars[key.trim()] = valueParts.join('=').trim()
          }
        }
      })

      return envVars
    } catch (error) {
      console.error('❌ Failed to read .env file:', error)
      throw error
    }
  }

  /**
   * Check if .env file exists
   * @param projectPath - Absolute path to project directory
   * @param fileName - Name of env file (default: .env)
   */
  envFileExists(projectPath: string, fileName: string = '.env'): boolean {
    const envFilePath = path.join(projectPath, fileName)
    return fs.existsSync(envFilePath)
  }

  /**
   * Delete .env file
   * @param projectPath - Absolute path to project directory
   * @param fileName - Name of env file (default: .env)
   */
  deleteEnvFile(projectPath: string, fileName: string = '.env'): void {
    try {
      const envFilePath = path.join(projectPath, fileName)

      if (fs.existsSync(envFilePath)) {
        fs.unlinkSync(envFilePath)
      }
    } catch (error) {
      console.error('❌ Failed to delete .env file:', error)
      throw error
    }
  }
}

export const envService = new EnvService()
