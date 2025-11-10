import fs from 'fs'
import path from 'path'

/**
 * Service for managing .claude/CLAUDE.md files in project directories
 */
class ClaudeMdService {
  private readonly ADDENDUM_START = '<user_addendum>'
  private readonly ADDENDUM_END = '</user_addendum>'

  /**
   * Get the path to the CLAUDE.md file for a project
   */
  private getClaudeMdPath(projectPath: string): string {
    return path.join(projectPath, '.claude', 'CLAUDE.md')
  }

  /**
   * Ensure .claude directory exists
   */
  private ensureClaudeDir(projectPath: string): void {
    const claudeDir = path.join(projectPath, '.claude')
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true })
    }
  }

  /**
   * Read the current addendum from CLAUDE.md
   * @param projectPath - Absolute path to project directory
   * @returns The addendum text or empty string if none exists
   */
  readAddendum(projectPath: string): string {
    try {
      const filePath = this.getClaudeMdPath(projectPath)

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return ''
      }

      const content = fs.readFileSync(filePath, 'utf-8')

      // Extract addendum between markers
      const startIndex = content.indexOf(this.ADDENDUM_START)
      const endIndex = content.indexOf(this.ADDENDUM_END)

      if (startIndex === -1 || endIndex === -1) {
        return ''
      }

      // Extract content between markers (excluding the markers themselves)
      const addendumWithMarkers = content.substring(
        startIndex + this.ADDENDUM_START.length,
        endIndex
      )

      return addendumWithMarkers.trim()
    } catch (error) {
      console.error('❌ Failed to read CLAUDE.md addendum:', error)
      return ''
    }
  }

  /**
   * Write or update the addendum in CLAUDE.md
   * @param projectPath - Absolute path to project directory
   * @param addendum - The addendum text to write
   */
  writeAddendum(projectPath: string, addendum: string): void {
    try {
      this.ensureClaudeDir(projectPath)
      const filePath = this.getClaudeMdPath(projectPath)

      let content = ''
      let existingContent = ''

      // Read existing content if file exists
      if (fs.existsSync(filePath)) {
        existingContent = fs.readFileSync(filePath, 'utf-8')

        // Remove existing addendum if present
        const startIndex = existingContent.indexOf(this.ADDENDUM_START)
        const endIndex = existingContent.indexOf(this.ADDENDUM_END)

        if (startIndex !== -1 && endIndex !== -1) {
          // Remove addendum section (including end marker and trailing newlines)
          const beforeAddendum = existingContent.substring(0, startIndex).trimEnd()
          const afterAddendum = existingContent.substring(
            endIndex + this.ADDENDUM_END.length
          ).trimStart()

          // Combine, ensuring no double newlines
          existingContent = afterAddendum
            ? `${beforeAddendum}\n\n${afterAddendum}`
            : beforeAddendum
        }

        content = existingContent
      }

      // Add new addendum if not empty
      if (addendum.trim()) {
        // Ensure there's proper spacing before addendum
        if (content && !content.endsWith('\n\n')) {
          content = content.trimEnd() + '\n\n'
        }

        content += `${this.ADDENDUM_START}\n${addendum.trim()}\n${this.ADDENDUM_END}\n`
      }

      // Write to file
      fs.writeFileSync(filePath, content, 'utf-8')

    } catch (error) {
      console.error('❌ Failed to write CLAUDE.md addendum:', error)
      throw error
    }
  }

  /**
   * Remove the addendum from CLAUDE.md
   * @param projectPath - Absolute path to project directory
   */
  removeAddendum(projectPath: string): void {
    this.writeAddendum(projectPath, '')
  }
}

export default new ClaudeMdService()
