/**
 * Authorization Middleware
 *
 * SECURITY: This module provides authorization checks to ensure users can only
 * access their own projects and resources.
 */

import { getCurrentUserId } from '../main.js'
import { databaseService } from '../services/DatabaseService.js'

/**
 * Error thrown when a user attempts to access a resource they don't own
 */
export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized access to resource') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Get the currently authenticated user ID
 * @throws {UnauthorizedError} if no user is logged in
 */
export function requireAuth(): string {
  const userId = getCurrentUserId()

  if (!userId) {
    console.error('🚫 Unauthorized: No user logged in')
    throw new UnauthorizedError('No user logged in')
  }

  return userId
}

/**
 * Validate that a project belongs to the current user
 * @param projectId - The project ID to validate
 * @throws {UnauthorizedError} if project doesn't exist or doesn't belong to current user
 * @returns The validated project
 */
export function validateProjectOwnership(projectId: string) {
  const userId = requireAuth()

  const project = databaseService.getProjectById(projectId)

  if (!project) {
    console.error(`🚫 Unauthorized: Project not found: ${projectId}`)
    throw new UnauthorizedError('Project not found')
  }

  // SECURITY: Check that the project belongs to the current user
  if (project.userId !== userId) {
    console.error(`🚫 Unauthorized: User ${userId} attempted to access project ${projectId} owned by ${project.userId}`)
    throw new UnauthorizedError('Access denied: Project belongs to another user')
  }

  console.log(`✅ Authorization passed: User ${userId} owns project ${projectId}`)
  return project
}

/**
 * Ensure the current user is the owner of a project before executing an operation
 * Wraps a handler function with authorization checks
 */
export function withProjectAuth<T>(
  projectId: string,
  operation: () => T
): T {
  validateProjectOwnership(projectId)
  return operation()
}
