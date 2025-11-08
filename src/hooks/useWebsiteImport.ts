import { useState, useEffect } from 'react'

interface WebsiteImportConfig {
  importType: 'template' | 'screenshot' | 'ai'
}

interface WebsiteImportManifest {
  config?: WebsiteImportConfig
  metadata: {
    sourceUrl: string
    analyzedAt: string
    title: string
    description: string
  }
  sections: any[]
  navigation: { items: Array<{ label: string; url: string }> }
  footer: {
    content: string
    links: Array<{ label: string; url: string }>
  }
}

interface UseWebsiteImportReturn {
  isWebsiteImport: boolean
  importType: 'template' | 'screenshot' | 'ai' | null
  isFirstOpen: boolean
  projectPath: string | null
  manifest: WebsiteImportManifest | null
  markMigrationComplete: () => Promise<void>
}

/**
 * Hook to detect and handle website import projects
 * Returns info about whether this is a website import and if it's the first time opening
 */
export function useWebsiteImport(projectId: string | null): UseWebsiteImportReturn {
  const [isWebsiteImport, setIsWebsiteImport] = useState(false)
  const [importType, setImportType] = useState<'template' | 'screenshot' | 'ai' | null>(null)
  const [isFirstOpen, setIsFirstOpen] = useState(false)
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [manifest, setManifest] = useState<WebsiteImportManifest | null>(null)

  useEffect(() => {
    const checkWebsiteImport = async () => {
      if (!projectId) {
        setIsWebsiteImport(false)
        setImportType(null)
        setIsFirstOpen(false)
        setProjectPath(null)
        setManifest(null)
        return
      }

      try {
        // Get project details to get the path
        const result = await window.electronAPI?.projects.getById(projectId)

        if (!result?.success || !result.project) {
          setIsWebsiteImport(false)
          return
        }

        const projPath = result.project.path
        setProjectPath(projPath)

        // Check if this is a website import via IPC
        const checkResult = await window.electronAPI?.websiteImport?.checkImportStatus?.(projectId)

        if (checkResult?.success && checkResult?.isImport) {
          setIsWebsiteImport(true)
          setImportType(checkResult.importType || null)
          setIsFirstOpen(!checkResult.migrationCompleted)
          setManifest(checkResult.manifest || null)
        } else {
          setIsWebsiteImport(false)
          setImportType(null)
          setIsFirstOpen(false)
          setManifest(null)
        }
      } catch (error) {
        console.error('Error checking website import status:', error)
        setIsWebsiteImport(false)
      }
    }

    checkWebsiteImport()
  }, [projectId])

  const markMigrationComplete = async () => {
    if (!projectId) return

    try {
      await window.electronAPI?.websiteImport?.markMigrationComplete?.(projectId)
      setIsFirstOpen(false)
      console.log('✅ [WEBSITE IMPORT] Migration marked as complete')
    } catch (error) {
      console.error('Error marking migration complete:', error)
    }
  }

  return {
    isWebsiteImport,
    importType,
    isFirstOpen,
    projectPath,
    manifest,
    markMigrationComplete
  }
}
