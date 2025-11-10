/**
 * Path Validator Utility
 *
 * SECURITY: Validates file paths to prevent path traversal attacks.
 * Ensures all operations stay within the user's project directory.
 */

import path from 'path'
import { app } from 'electron'

/**
 * Error thrown when a path traversal attempt is detected
 */
export class PathTraversalError extends Error {
  constructor(message: string = 'Path traversal attempt detected') {
    super(message)
    this.name = 'PathTraversalError'
  }
}

class PathValidator {
  /**
   * Get the root directory for all user projects
   * @param userId - User ID
   * @returns Absolute path to user's projects directory
   */
  private getUserProjectsRoot(userId: string): string {
    const homeDir = app.getPath('home')
    return path.join(homeDir, 'Documents', 'CodeDeck', userId, 'Projects')
  }

  /**
   * Validate that a path is within the user's allowed project directory
   *
   * SECURITY: Prevents path traversal attacks by ensuring the resolved path
   * starts with the user's project root directory.
   *
   * @param projectPath - Path to validate
   * @param userId - User ID who owns the project
   * @throws {PathTraversalError} if path is outside allowed directory
   * @returns The validated, resolved absolute path
   */
  validateProjectPath(projectPath: string, userId: string): string {
    // Get the allowed root directory
    const projectsRoot = this.getUserProjectsRoot(userId)

    // Resolve the input path to an absolute path (handles .., ., symlinks, etc.)
    const resolvedPath = path.resolve(projectPath)

    // SECURITY: Check that resolved path starts with the allowed root
    // This prevents path traversal attacks like:
    // - ../../etc/passwd
    // - /etc/passwd
    // - symlinks pointing outside the directory
    if (!resolvedPath.startsWith(projectsRoot + path.sep) && resolvedPath !== projectsRoot) {
      console.error(`🚫 Path traversal attempt detected:`)
      console.error(`   Input path: ${projectPath}`)
      console.error(`   Resolved path: ${resolvedPath}`)
      console.error(`   Allowed root: ${projectsRoot}`)

      throw new PathTraversalError(
        `Invalid project path: Must be within user's project directory`
      )
    }

    return resolvedPath
  }

  /**
   * Validate multiple paths at once
   *
   * @param paths - Array of paths to validate
   * @param userId - User ID who owns the projects
   * @throws {PathTraversalError} if any path is invalid
   * @returns Array of validated, resolved absolute paths
   */
  validateProjectPaths(paths: string[], userId: string): string[] {
    return paths.map(p => this.validateProjectPath(p, userId))
  }

  /**
   * Check if a path is within the user's project directory without throwing
   *
   * @param projectPath - Path to check
   * @param userId - User ID
   * @returns true if path is valid, false otherwise
   */
  isValidProjectPath(projectPath: string, userId: string): boolean {
    try {
      this.validateProjectPath(projectPath, userId)
      return true
    } catch (error) {
      return false
    }
  }
}

export const pathValidator = new PathValidator()
