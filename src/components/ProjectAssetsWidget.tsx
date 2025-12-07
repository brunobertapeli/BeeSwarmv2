import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, FolderOpen, ChevronRight, ChevronDown, Folder, FileImage, Music, FileType, Image as ImageIcon, Loader2, ExternalLink, Copy, MessageSquarePlus, Edit3, Scissors, Pencil } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import { useAppStore } from '../store/appStore'
import { motion, AnimatePresence } from 'framer-motion'
import ImageEditorModal from './ImageEditorModal'
import AudioEditorModal from './AudioEditorModal'

interface FileNode {
  name: string
  type: 'folder' | 'file'
  children?: FileNode[]
  fileType?: 'image' | 'audio' | 'font' | 'other'
  size?: string
  dimensions?: string
  path?: string
  relativePath?: string
}

// Mock folder structure
const MOCK_ASSETS: FileNode[] = [
  {
    name: 'images',
    type: 'folder',
    children: [
      { name: 'logo.png', type: 'file', fileType: 'image', size: '24 KB' },
      { name: 'hero-bg.jpg', type: 'file', fileType: 'image', size: '156 KB' },
      { name: 'avatar.png', type: 'file', fileType: 'image', size: '8 KB' },
      {
        name: 'icons',
        type: 'folder',
        children: [
          { name: 'home.svg', type: 'file', fileType: 'image', size: '2 KB' },
          { name: 'settings.svg', type: 'file', fileType: 'image', size: '1 KB' },
          { name: 'user.svg', type: 'file', fileType: 'image', size: '1 KB' }
        ]
      }
    ]
  },
  {
    name: 'sounds',
    type: 'folder',
    children: [
      { name: 'click.mp3', type: 'file', fileType: 'audio', size: '12 KB' },
      { name: 'notification.wav', type: 'file', fileType: 'audio', size: '28 KB' }
    ]
  },
  {
    name: 'fonts',
    type: 'folder',
    children: [
      { name: 'inter-regular.woff2', type: 'file', fileType: 'font', size: '64 KB' },
      { name: 'inter-bold.woff2', type: 'file', fileType: 'font', size: '68 KB' }
    ]
  },
  { name: 'favicon.ico', type: 'file', fileType: 'image', size: '4 KB' }
]

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  file: FileNode | null
  filePath: string
  type: 'file' | 'folder' | 'header'
}

interface PreviewState {
  file: FileNode
  filePath: string
  src: string
  x: number
  y: number
}

function ProjectAssetsWidget() {
  const { projectAssetsWidgetPosition, setProjectAssetsWidgetPosition, setProjectAssetsWidgetEnabled, addImageReference, setPrefilledMessage, projectAssetsWidgetZIndex, bringWidgetToFront } = useLayoutStore()
  const { currentProjectId } = useAppStore()
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set()) // Start with all folders collapsed
  const [assets, setAssets] = useState<FileNode[]>(MOCK_ASSETS) // Start with mock data
  const [isLoading, setIsLoading] = useState(true)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, file: null, filePath: '', type: 'file' })
  const [previewImage, setPreviewImage] = useState<PreviewState | null>(null)
  const [editorModal, setEditorModal] = useState<{ open: boolean; file: FileNode | null; filePath: string; src: string } | null>(null)
  const [audioEditorModal, setAudioEditorModal] = useState<{ open: boolean; file: FileNode | null; filePath: string } | null>(null)
  const [renamingFile, setRenamingFile] = useState<{ path: string; name: string; extension: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const FIXED_WIDTH = 400
  const FIXED_HEIGHT = 500

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, file: null, filePath: '', type: 'file' })
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu.visible])

  // Close preview with Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewImage) {
        setPreviewImage(null)
      }
      if (e.key === 'Escape' && renamingFile) {
        setRenamingFile(null)
        setRenameValue('')
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [previewImage, renamingFile])

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingFile && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingFile])

  // Load real assets when widget opens
  const loadAssets = async (resetFolders = true) => {
    if (!currentProjectId) return

    try {
      setIsLoading(true)
      // Reset folders to collapsed state on load (unless refreshing after save)
      if (resetFolders) {
        setExpandedFolders(new Set())
      }

      const result = await window.electronAPI?.projects.getAssetsStructure(currentProjectId)

      if (result?.success && result.assets) {
        if (result.assets.length > 0) {
          setAssets(result.assets)
        } else {
          // Keep mock data if no real assets found
          setAssets(MOCK_ASSETS)
        }
      } else {
        // Keep mock data on error
        setAssets(MOCK_ASSETS)
      }
    } catch (error) {
      console.error('Failed to load assets:', error)
      // Keep mock data on error
      setAssets(MOCK_ASSETS)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!currentProjectId) return
    loadAssets()
  }, [currentProjectId])

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }

  const getFileIcon = (fileType?: string) => {
    switch (fileType) {
      case 'image':
        return <ImageIcon size={14} className="text-blue-400 flex-shrink-0" />
      case 'audio':
        return <Music size={14} className="text-purple-400 flex-shrink-0" />
      case 'font':
        return <FileType size={14} className="text-green-400 flex-shrink-0" />
      default:
        return <FileImage size={14} className="text-gray-400 flex-shrink-0" />
    }
  }

  const handleFileClick = async (e: React.MouseEvent, node: FileNode, filePath: string) => {
    // Left click on image - show preview
    if (node.fileType === 'image') {
      try {
        // Read file as base64 for preview
        const fileData = await window.electronAPI?.files?.readFileAsBase64?.(filePath)
        if (fileData) {
          // Determine mime type from extension
          const ext = node.name.split('.').pop()?.toLowerCase()
          let mimeType = 'image/png'
          if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
          else if (ext === 'gif') mimeType = 'image/gif'
          else if (ext === 'svg') mimeType = 'image/svg+xml'
          else if (ext === 'webp') mimeType = 'image/webp'

          setPreviewImage({
            file: node,
            filePath,
            src: `data:${mimeType};base64,${fileData}`,
            x: e.clientX,
            y: e.clientY
          })
        }
      } catch (error) {
        console.error('Failed to load image:', error)
      }
    }
  }

  const handleFileDoubleClick = async (node: FileNode, filePath: string) => {
    // Double click disabled - use context menu instead
    if (node.type === 'file') {
      // Do nothing on double click
    }
  }

  const handleFileRightClick = (e: React.MouseEvent, node: FileNode, filePath: string) => {
    e.preventDefault()
    e.stopPropagation()

    setContextMenu({
      visible: true,
      x: e.clientX, // Use clientX for viewport-relative position
      y: e.clientY, // Use clientY for viewport-relative position
      file: node,
      filePath,
      type: node.type === 'file' ? 'file' : 'folder'
    })
  }

  const handleFolderRightClick = (e: React.MouseEvent, folderName: string, fullPath: string) => {
    e.preventDefault()
    e.stopPropagation()

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      file: { name: folderName, type: 'folder' },
      filePath: fullPath,
      type: 'folder'
    })
  }

  const handleHeaderRightClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!currentProjectId) return

    // Get the assets folder path from the first asset item
    let assetsPath = ''
    if (assets.length > 0 && assets[0].path) {
      // Get parent folder of first item
      assetsPath = assets[0].path.substring(0, assets[0].path.lastIndexOf('/'))
    }

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      file: { name: 'public/assets/', type: 'folder' },
      filePath: assetsPath,
      type: 'header'
    })
  }

  const handleContextMenuAction = async (action: string) => {
    if (!contextMenu.file || !currentProjectId) return

    switch (action) {
      case 'use-context':
        try {
          const displayPath = contextMenu.file.relativePath || contextMenu.filePath

          if (contextMenu.file.fileType === 'audio') {
            // For audio files, get duration and show sound path
            try {
              const fileData = await window.electronAPI?.files?.readFileAsBase64?.(contextMenu.filePath)
              if (fileData) {
                const ext = contextMenu.file.name.split('.').pop()?.toLowerCase()
                const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/mpeg'
                const audioUrl = `data:${mimeType};base64,${fileData}`

                // Create audio element to get duration
                const audio = new Audio(audioUrl)
                await new Promise<void>((resolve) => {
                  audio.onloadedmetadata = () => resolve()
                  audio.onerror = () => resolve()
                })

                const duration = audio.duration
                const formattedDuration = duration && !isNaN(duration)
                  ? duration < 60
                    ? `${Math.round(duration)}s`
                    : `${Math.floor(duration / 60)}m ${Math.round(duration % 60)}s`
                  : 'Unknown'

                const message = `[Sound Path: '${displayPath}' Duration: ${formattedDuration}]`
                setPrefilledMessage(message)
              }
            } catch {
              const message = `[Sound Path: '${displayPath}' Duration: Unknown]`
              setPrefilledMessage(message)
            }
          } else {
            // For images, read as base64 and add reference
            const fileData = await window.electronAPI?.files?.readFileAsBase64?.(contextMenu.filePath)
            if (fileData && contextMenu.file) {
              // Determine mime type from extension
              const ext = contextMenu.file.name.split('.').pop()?.toLowerCase()
              let mimeType = 'image/png'
              if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
              else if (ext === 'gif') mimeType = 'image/gif'
              else if (ext === 'svg') mimeType = 'image/svg+xml'
              else if (ext === 'webp') mimeType = 'image/webp'

              // Add image reference to ActionBar
              addImageReference({
                id: `asset-${Date.now()}`,
                name: contextMenu.file.name,
                path: contextMenu.filePath,
                src: `data:${mimeType};base64,${fileData}`,
                dimensions: contextMenu.file.dimensions || 'Unknown'
              })

              const message = `[Image Path: '${displayPath}' Dimensions: ${contextMenu.file.dimensions || 'Unknown'}]`
              setPrefilledMessage(message)
            }
          }
        } catch (error) {
          console.error('Failed to add to context:', error)
        }
        break
      case 'edit-image':
        try {
          // Read image as base64 for editor
          const fileData = await window.electronAPI?.files?.readFileAsBase64?.(contextMenu.filePath)
          if (fileData && contextMenu.file) {
            const ext = contextMenu.file.name.split('.').pop()?.toLowerCase()
            let mimeType = 'image/png'
            if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
            else if (ext === 'gif') mimeType = 'image/gif'
            else if (ext === 'svg') mimeType = 'image/svg+xml'
            else if (ext === 'webp') mimeType = 'image/webp'

            setEditorModal({
              open: true,
              file: contextMenu.file,
              filePath: contextMenu.filePath,
              src: `data:${mimeType};base64,${fileData}`
            })
          }
        } catch (error) {
          console.error('Failed to open editor:', error)
        }
        break
      case 'edit-audio':
        if (contextMenu.file) {
          setAudioEditorModal({
            open: true,
            file: contextMenu.file,
            filePath: contextMenu.filePath
          })
        }
        break
      case 'open-file':
        try {
          await window.electronAPI?.shell?.openPath(contextMenu.filePath)
        } catch (error) {
          console.error('Failed to open file:', error)
        }
        break
      case 'show-finder':
        try {
          await window.electronAPI?.shell?.showItemInFolder(contextMenu.filePath)
        } catch (error) {
          console.error('Failed to show in folder:', error)
        }
        break
      case 'copy-path':
        try {
          await navigator.clipboard.writeText(contextMenu.filePath)
        } catch (error) {
          console.error('Failed to copy path:', error)
        }
        break
      case 'rename':
        if (contextMenu.file) {
          const fileName = contextMenu.file.name
          const lastDotIndex = fileName.lastIndexOf('.')
          const nameWithoutExt = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName
          const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : ''

          setRenamingFile({
            path: contextMenu.filePath,
            name: nameWithoutExt,
            extension: extension
          })
          setRenameValue(nameWithoutExt)
        }
        break
    }

    setContextMenu({ visible: false, x: 0, y: 0, file: null, filePath: '', type: 'file' })
  }

  const handleRenameSubmit = async () => {
    if (!renamingFile || !renameValue.trim() || !currentProjectId) {
      setRenamingFile(null)
      setRenameValue('')
      return
    }

    const newName = renameValue.trim() + renamingFile.extension
    if (newName === renamingFile.name + renamingFile.extension) {
      setRenamingFile(null)
      setRenameValue('')
      return
    }

    try {
      const result = await window.electronAPI?.files?.renameFile?.(renamingFile.path, newName)
      if (result?.success) {
        await loadAssets(false)
      } else {
        console.error('Failed to rename file:', result?.error)
      }
    } catch (error) {
      console.error('Failed to rename file:', error)
    }

    setRenamingFile(null)
    setRenameValue('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      setRenamingFile(null)
      setRenameValue('')
    }
  }

  const renderNode = (node: FileNode, path: string, depth: number = 0) => {
    const fullPath = path ? `${path}/${node.name}` : node.name
    const isExpanded = expandedFolders.has(fullPath)

    if (node.type === 'folder') {
      const folderFullPath = node.path || fullPath

      return (
        <div key={fullPath}>
          <button
            onClick={() => toggleFolder(fullPath)}
            onContextMenu={(e) => handleFolderRightClick(e, node.name, folderFullPath)}
            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-dark-bg/40 rounded transition-colors text-left group"
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen size={14} className="text-yellow-500 flex-shrink-0" />
            ) : (
              <Folder size={14} className="text-yellow-500 flex-shrink-0" />
            )}
            <span className="text-xs text-gray-300 truncate flex-1 group-hover:text-white transition-colors">
              {node.name}
            </span>
            {node.children && (
              <span className="text-[10px] text-gray-600 flex-shrink-0">
                {node.children.length}
              </span>
            )}
          </button>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderNode(child, fullPath, depth + 1))}
            </div>
          )}
        </div>
      )
    } else {
      const fileFullPath = node.path || fullPath
      const isRenaming = renamingFile?.path === fileFullPath

      // Split filename for rename display
      const lastDotIndex = node.name.lastIndexOf('.')
      const extension = lastDotIndex > 0 ? node.name.substring(lastDotIndex) : ''

      return (
        <div
          key={fullPath}
          className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-dark-bg/40 rounded transition-colors text-left group cursor-pointer"
          style={{ paddingLeft: `${24 + depth * 16}px` }}
          onClick={(e) => !isRenaming && handleFileClick(e, node, fileFullPath)}
          onDoubleClick={() => !isRenaming && handleFileDoubleClick(node, fileFullPath)}
          onContextMenu={(e) => !isRenaming && handleFileRightClick(e, node, fileFullPath)}
        >
          {getFileIcon(node.fileType)}
          {isRenaming ? (
            <div className="flex items-center min-w-0" style={{ flex: '1 1 0' }}>
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleRenameSubmit}
                className="text-xs bg-dark-bg border border-blue-500 rounded px-1 py-0.5 text-white outline-none min-w-0"
                style={{ width: `${Math.max(renameValue.length * 7, 50)}px` }}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-gray-500">{extension}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400 truncate min-w-0 group-hover:text-white transition-colors" style={{ flex: '1 1 0' }}>
              {node.name}
            </span>
          )}
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {node.fileType === 'image' && (
              <span className="text-[10px] text-blue-400 font-mono" style={{ minWidth: '60px', textAlign: 'right' }}>
                {node.dimensions || '---'}
              </span>
            )}
            <span className="text-[10px] text-gray-600 font-mono" style={{ minWidth: '50px', textAlign: 'right' }}>
              {node.size}
            </span>
          </div>
        </div>
      )
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!headerRef.current?.contains(e.target as Node)) {
      return
    }

    setIsDragging(true)
    setDragOffset({
      x: e.clientX - projectAssetsWidgetPosition.x,
      y: e.clientY - projectAssetsWidgetPosition.y
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        const padding = 5
        const headerHeight = 40 + padding
        const bottomReservedArea = 200 + 2
        const minX = padding
        const maxX = window.innerWidth - FIXED_WIDTH - padding
        const minY = headerHeight
        const maxY = window.innerHeight - FIXED_HEIGHT - bottomReservedArea - padding

        setProjectAssetsWidgetPosition({
          x: Math.max(minX, Math.min(newX, maxX)),
          y: Math.max(minY, Math.min(newY, maxY))
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, projectAssetsWidgetPosition, setProjectAssetsWidgetPosition, FIXED_HEIGHT])

  const widgetElement = (
    <div
      ref={widgetRef}
      className="fixed bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 shadow-2xl overflow-hidden"
      style={{
        left: `${projectAssetsWidgetPosition.x}px`,
        top: `${projectAssetsWidgetPosition.y}px`,
        width: `${FIXED_WIDTH}px`,
        height: `${FIXED_HEIGHT}px`,
        zIndex: projectAssetsWidgetZIndex
      }}
      onMouseDown={(e) => { bringWidgetToFront('projectAssets'); handleMouseDown(e); }}
    >
      {/* Header */}
      <div
        ref={headerRef}
        className="relative px-4 border-b border-dark-border/50 flex items-center justify-between cursor-move select-none"
        style={{ height: '37px', minHeight: '37px' }}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-200">Project Assets</h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setProjectAssetsWidgetEnabled(false)}
            className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X size={16} className="text-gray-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="relative overflow-y-auto scrollbar-thin"
        style={{ height: `calc(${FIXED_HEIGHT}px - 37px)` }}
      >
        {/* Header with path */}
        <div
          className="sticky top-0 z-10 bg-dark-card/95 backdrop-blur-sm border-b border-dark-border/30 px-3 py-2 cursor-context-menu"
          onContextMenu={handleHeaderRightClick}
        >
          <div className="flex items-center gap-2">
            <FolderOpen size={12} className="text-yellow-500" />
            <span className="text-[10px] text-gray-500 font-mono">public/assets/</span>
          </div>
        </div>

        {/* File tree */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="animate-spin text-gray-600" size={24} />
          </div>
        ) : (
          <>
            <div className="p-2">
              {assets.length > 0 ? (
                assets.map(node => renderNode(node, '', 0))
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-xs gap-2">
                  <FolderOpen size={24} className="text-gray-600" />
                  <p>No assets found</p>
                </div>
              )}
            </div>

            {/* Info hint - only show if using mock data */}
            {assets === MOCK_ASSETS && (
              <div className="px-3 pb-3 pt-6">
                <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 text-center">
                    Showing preview with mock data.
                    <br />
                    Real assets folder not found.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  // Render context menu and preview via portal to avoid positioning issues
  const contextMenuPortal = createPortal(
    <>
      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu.visible && contextMenu.file && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[200] bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 rounded-lg shadow-2xl py-1 min-w-[180px]"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Only show "Use for Context" for files */}
            {contextMenu.type === 'file' && (
              <button
                onClick={() => handleContextMenuAction('use-context')}
                className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-dark-bg/50 flex items-center gap-2 transition-colors"
              >
                <MessageSquarePlus size={14} className="text-blue-400" />
                Use for Context
              </button>
            )}

            {/* Only show "Image Editor" for image files */}
            {contextMenu.type === 'file' && contextMenu.file?.fileType === 'image' && (
              <button
                onClick={() => handleContextMenuAction('edit-image')}
                className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-dark-bg/50 flex items-center gap-2 transition-colors"
              >
                <Edit3 size={14} className="text-purple-400" />
                Image Editor
              </button>
            )}

            {/* Only show "Audio Editor" for audio files */}
            {contextMenu.type === 'file' && contextMenu.file?.fileType === 'audio' && (
              <button
                onClick={() => handleContextMenuAction('edit-audio')}
                className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-dark-bg/50 flex items-center gap-2 transition-colors"
              >
                <Scissors size={14} className="text-orange-400" />
                Audio Editor
              </button>
            )}

            {/* Only show "Open File" for image files */}
            {contextMenu.type === 'file' && contextMenu.file?.fileType === 'image' && (
              <button
                onClick={() => handleContextMenuAction('open-file')}
                className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-dark-bg/50 flex items-center gap-2 transition-colors"
              >
                <ExternalLink size={14} className="text-green-400" />
                Open Image
              </button>
            )}

            <button
              onClick={() => handleContextMenuAction('show-finder')}
              className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-dark-bg/50 flex items-center gap-2 transition-colors"
            >
              <ExternalLink size={14} className="text-gray-400" />
              Show in {navigator.platform.includes('Mac') ? 'Finder' : 'Explorer'}
            </button>
            {/* Rename option for files */}
            {contextMenu.type === 'file' && (
              <button
                onClick={() => handleContextMenuAction('rename')}
                className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-dark-bg/50 flex items-center gap-2 transition-colors"
              >
                <Pencil size={14} className="text-yellow-400" />
                Rename
              </button>
            )}

            <button
              onClick={() => handleContextMenuAction('copy-path')}
              className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-dark-bg/50 flex items-center gap-2 transition-colors"
            >
              <Copy size={14} className="text-gray-400" />
              Copy Path
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal (Mac Quick Look style) */}
      <AnimatePresence>
        {previewImage && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm"
              onClick={() => setPreviewImage(null)}
            />

            {/* Preview Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed z-[301] bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 rounded-xl shadow-2xl overflow-hidden"
              style={{
                left: `${previewImage.x + 10}px`,
                top: `${previewImage.y + 10}px`,
                maxWidth: '400px',
                maxHeight: '500px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-dark-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon size={16} className="text-blue-400" />
                  <h3 className="text-sm font-medium text-gray-200">{previewImage.file.name}</h3>
                </div>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
                >
                  <X size={16} className="text-gray-400 hover:text-white" />
                </button>
              </div>

              {/* Image */}
              <div className="p-6 flex items-center justify-center" style={{ maxWidth: '800px', maxHeight: 'calc(90vh - 120px)' }}>
                <img
                  src={previewImage.src}
                  alt={previewImage.file.name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                  style={{ maxHeight: 'calc(90vh - 150px)' }}
                />
              </div>

              {/* Footer with metadata */}
              <div className="px-4 py-3 border-t border-dark-border/50 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Dimensions:</span>
                  <span className="text-blue-400 font-mono">{previewImage.file.dimensions || '---'}</span>
                </div>
                <span className="text-gray-600">Press ESC to close</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body
  )

  return (
    <>
      {widgetElement}
      {contextMenuPortal}

      {/* Image Editor Modal */}
      {editorModal && (
        <ImageEditorModal
          isOpen={editorModal.open}
          onClose={() => setEditorModal(null)}
          onSave={() => loadAssets(false)}
          imageSrc={editorModal.src}
          imageWidth={editorModal.file?.dimensions ? parseInt(editorModal.file.dimensions.split('x')[0]) : undefined}
          imageHeight={editorModal.file?.dimensions ? parseInt(editorModal.file.dimensions.split('x')[1]) : undefined}
          imagePath={editorModal.filePath}
          imageName={editorModal.file?.name}
        />
      )}

      {/* Audio Editor Modal */}
      {audioEditorModal && (
        <AudioEditorModal
          isOpen={audioEditorModal.open}
          onClose={() => setAudioEditorModal(null)}
          onSave={() => loadAssets(false)}
          audioPath={audioEditorModal.filePath}
          audioName={audioEditorModal.file?.name}
        />
      )}
    </>
  )
}

export default ProjectAssetsWidget
