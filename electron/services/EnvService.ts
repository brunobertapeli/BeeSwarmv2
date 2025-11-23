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

  /**
   * Read all env files for a project based on envFiles configuration
   * @param projectPath - Absolute path to project directory
   * @param envFiles - Array of env file configurations from template
   * @returns Array of env file data with path, label, description, and variables
   */
  readProjectEnvFiles(
    projectPath: string,
    envFiles: Array<{ path: string; label: string; description: string }>
  ): Array<{
    path: string
    label: string
    description: string
    variables: Record<string, string>
    exists: boolean
  }> {
    return envFiles.map(envFile => {
      const fullPath = path.join(projectPath, envFile.path)
      const exists = fs.existsSync(fullPath)

      return {
        path: envFile.path,
        label: envFile.label,
        description: envFile.description,
        variables: exists ? this.readEnvFile(projectPath, envFile.path) : {},
        exists
      }
    })
  }

  /**
   * Write variables to a specific env file
   * @param projectPath - Absolute path to project directory
   * @param filePath - Relative path to env file (e.g., ".env" or "frontend/.env")
   * @param variables - Object with key-value pairs to write
   */
  writeProjectEnvFile(
    projectPath: string,
    filePath: string,
    variables: Record<string, string>
  ): void {
    this.writeEnvFile(projectPath, variables, filePath)
  }
}

export const envService = new EnvService()
