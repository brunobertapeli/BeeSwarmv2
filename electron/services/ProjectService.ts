import { databaseService, Project } from './DatabaseService'
import { templateService } from './TemplateService'
import { templateValidator } from './TemplateValidator'
import { portService } from './PortService'
import { Template } from './MongoService'
import fs from 'fs'
import path from 'path'
import { shell } from 'electron'

class ProjectService {
  /**
   * Create a new project from a template
   * @param templateId - Template ID
   * @param projectName - Name for the new project
   * @param template - Full template object from MongoDB
   * @returns Created project metadata
   */
  async createProject(
    templateId: string,
    projectName: string,
    template: Template
  ): Promise<Project> {
    try {
      console.log('🚀 Starting project creation...')
      console.log('   Template:', template.name)
      console.log('   Project Name:', projectName)

      // Step 1: Check if project already exists
      if (templateService.projectExists(projectName)) {
        throw new Error(`A project with the name "${projectName}" already exists`)
      }

      // Step 2: Create project in database with 'creating' status
      const projectPath = templateService.getProjectPath(projectName)
      const project = databaseService.createProject({
        name: projectName,
        path: projectPath,
        templateId: templateId,
        templateName: template.name,
        status: 'creating'
      })

      console.log('✅ Project record created in database')

      try {
        // Step 3: Clone template from GitHub
        const clonedPath = await templateService.cloneTemplate(
          template.githubUrl,
          projectName,
          project.id // Pass projectId for terminal output
        )

        console.log('✅ Template cloned to:', clonedPath)

        // Step 4: Validate template structure
        const validationResult = templateValidator.validate(clonedPath)

        if (!validationResult.valid) {
          console.error('❌ Template validation failed:')
          validationResult.errors.forEach(error => console.error(`   • ${error}`))

          // Update status to error
          databaseService.updateProjectStatus(project.id, 'error')

          // Throw error with validation details
          throw new Error(
            `Template structure validation failed:\n${validationResult.errors.join('\n')}`
          )
        }

        // Log warnings but don't fail
        if (validationResult.warnings.length > 0) {
          console.warn('⚠️ Template validation warnings:')
          validationResult.warnings.forEach(warning => console.warn(`   • ${warning}`))
        }

        console.log('✅ Template structure validated')

        // Step 5: Allocate ports and update configuration files
        console.log('🔧 Allocating ports and updating configuration...')

        // Allocate paired ports (Netlify + Vite)
        const netlifyPort = await portService.findAvailablePort(project.id)
        const vitePort = portService.getVitePort(netlifyPort)

        console.log(`   Allocated: Netlify ${netlifyPort}, Vite ${vitePort}`)

        // Update vite.config.ts with allocated Vite port
        templateService.updateViteConfig(clonedPath, vitePort)

        // Update netlify.toml with allocated Vite port
        templateService.updateNetlifyToml(clonedPath, vitePort)

        console.log('✅ Configuration files updated')

        // Step 6: Update project status to 'ready'
        databaseService.updateProjectStatus(project.id, 'ready')

        console.log('✅ Project created successfully!')

        return {
          ...project,
          status: 'ready'
        }
      } catch (cloneError) {
        // If cloning fails, update status to 'error'
        databaseService.updateProjectStatus(project.id, 'error')
        throw cloneError
      }
    } catch (error) {
      console.error('❌ Project creation failed:', error)
      throw error
    }
  }

  /**
   * Get all projects
   */
  getAllProjects(): Project[] {
    return databaseService.getAllProjects()
  }

  /**
   * Get project by ID
   */
  getProjectById(id: string): Project | null {
    return databaseService.getProjectById(id)
  }

  /**
   * Delete project from database and filesystem
   */
  deleteProject(id: string): void {
    const project = databaseService.getProjectById(id)

    if (project) {
      // Delete from filesystem
      if (fs.existsSync(project.path)) {
        fs.rmSync(project.path, { recursive: true, force: true })
        console.log('✅ Project deleted from filesystem:', project.path)
      }
    }

    // Release allocated port
    portService.releasePort(id)
    console.log('✅ Port released for project:', id)

    // Delete from database
    databaseService.deleteProject(id)
    console.log('✅ Project deleted from database:', id)
  }

  /**
   * Rename project (update name in database and folder name)
   */
  renameProject(id: string, newName: string): Project {
    const project = databaseService.getProjectById(id)

    if (!project) {
      throw new Error('Project not found')
    }

    // Check if new project name already exists
    if (templateService.projectExists(newName)) {
      throw new Error(`A project with the name "${newName}" already exists`)
    }

    // Get new path
    const newPath = templateService.getProjectPath(newName)

    // Rename directory
    if (fs.existsSync(project.path)) {
      fs.renameSync(project.path, newPath)
      console.log('✅ Project folder renamed:', project.path, '→', newPath)
    }

    // Update database
    const updatedProject = databaseService.renameProject(id, newName, newPath)
    console.log('✅ Project renamed in database:', newName)

    return updatedProject
  }

  /**
   * Open project folder in Finder (macOS) or Explorer (Windows)
   */
  showInFinder(id: string): void {
    const project = databaseService.getProjectById(id)

    if (!project) {
      throw new Error('Project not found')
    }

    if (!fs.existsSync(project.path)) {
      throw new Error('Project folder not found')
    }

    shell.showItemInFolder(project.path)
    console.log('✅ Opened in Finder/Explorer:', project.path)
  }

  /**
   * Toggle favorite status
   */
  toggleFavorite(id: string): boolean {
    return databaseService.toggleFavorite(id)
  }

  /**
   * Update last opened timestamp
   */
  updateLastOpened(id: string): void {
    databaseService.updateLastOpened(id)
  }
}

export const projectService = new ProjectService()
