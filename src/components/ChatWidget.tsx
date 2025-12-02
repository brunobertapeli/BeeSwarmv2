import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, ChevronDown, Plus, Sparkles, User, Bot, Clock, Trash2, MessageSquare, Image as ImageIcon, FolderPlus, ExternalLink, Copy, Check, AlertCircle, Lock, Crown, FolderOpen, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLayoutStore } from '../store/layoutStore'
import { useAppStore } from '../store/appStore'
import bgImage from '../assets/images/bg.jpg'
import noiseBgImage from '../assets/images/noise_bg.png'

type ResizeDirection = 's' | 'n' | 'e' | 'w' | null

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  type?: 'text' | 'image'
  imageUrl?: string
  imageLocalPath?: string // Local file path for Show in Finder, Open, etc.
}

interface Conversation {
  id: string
  title: string
  preview: string
  timestamp: Date
  messages: Message[]
  modelCategory: ModelCategory
  model: string
}

type ModelCategory = 'chat' | 'images'

interface AIModel {
  id: string
  displayName: string
  description: string
  provider: string
}

// Fallback models when backend is unavailable
const FALLBACK_CHAT_MODELS: AIModel[] = [
  { id: 'gpt-4.1-mini', displayName: 'GPT-4.1 Mini', description: 'Fast & efficient', provider: 'openai' },
  { id: 'gpt-4.1', displayName: 'GPT-4.1', description: 'Most powerful', provider: 'openai' },
]
const FALLBACK_IMAGE_MODELS: AIModel[] = [
  { id: 'gpt-image-1', displayName: 'GPT Image', description: 'Best quality', provider: 'openai' },
]

function ChatWidget() {
  const {
    chatWidgetPosition,
    setChatWidgetPosition,
    chatWidgetSize,
    setChatWidgetSize,
    setChatWidgetEnabled,
    chatWidgetZIndex,
    bringWidgetToFront
  } = useLayoutStore()

  const { currentProjectId, user } = useAppStore()

  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })

  // Models state - fetched from backend
  const [chatModels, setChatModels] = useState<AIModel[]>(FALLBACK_CHAT_MODELS)
  const [imageModels, setImageModels] = useState<AIModel[]>(FALLBACK_IMAGE_MODELS)
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState<string | null>(null)

  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [message, setMessage] = useState('')
  const [modelCategory, setModelCategory] = useState<ModelCategory>('chat')
  const [selectedChatModel, setSelectedChatModel] = useState('gpt-4.1-mini')
  const [selectedImageModel, setSelectedImageModel] = useState('gpt-image-1')
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [savedToAssetsId, setSavedToAssetsId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [projectPath, setProjectPath] = useState<string | null>(null)

  // Get current model based on category
  const currentModels = modelCategory === 'chat' ? chatModels : imageModels
  const selectedModel = modelCategory === 'chat' ? selectedChatModel : selectedImageModel
  const setSelectedModel = modelCategory === 'chat' ? setSelectedChatModel : setSelectedImageModel
  // Show first model's name as fallback if current selection not found
  const currentModelDisplay = currentModels.find(m => m.id === selectedModel)?.displayName
    || currentModels[0]?.displayName
    || (modelCategory === 'chat' ? 'GPT-4.1 Mini' : 'GPT Image')

  // Check if user has access to current feature based on plan
  const userPlan = user?.plan || 'free'
  const hasChatAccess = userPlan === 'plus' || userPlan === 'premium'
  const hasImageAccess = userPlan === 'premium'
  const hasCurrentFeatureAccess = modelCategory === 'chat' ? hasChatAccess : hasImageAccess
  const requiredPlan = modelCategory === 'chat' ? 'Plus' : 'Premium'

  // Handle upgrade click - open pricing page
  const handleUpgrade = async () => {
    await window.electronAPI?.shell?.openExternal('https://www.codedeckai.com/#pricing')
  }

  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const MIN_WIDTH = 380
  const MAX_WIDTH = 700
  const MIN_HEIGHT = 450
  const MAX_HEIGHT = 850

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    return `${diffDays}d ago`
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages])

  // Close model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false)
      }
    }

    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelDropdown])

  // Fetch models from backend on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setModelsLoading(true)
        setModelsError(null)
        const result = await window.electronAPI?.chatWidget?.getModels()
        if (result?.success && result.models) {
          setChatModels(result.models.chat || FALLBACK_CHAT_MODELS)
          setImageModels(result.models.images || FALLBACK_IMAGE_MODELS)
          // Set first model as default if available
          if (result.models.chat?.length > 0) {
            setSelectedChatModel(result.models.chat[0].id)
          }
          if (result.models.images?.length > 0) {
            setSelectedImageModel(result.models.images[0].id)
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch models:', err)
        setModelsError(err.message || 'Failed to load models')
      } finally {
        setModelsLoading(false)
      }
    }
    fetchModels()
  }, [])

  // Load conversations and project path when projectId changes
  useEffect(() => {
    const loadConversations = async () => {
      if (!currentProjectId) {
        setConversations([])
        setActiveConversation(null)
        setProjectPath(null)
        return
      }

      try {
        // Get project path
        const projectResult = await window.electronAPI?.projects?.getById(currentProjectId)
        if (projectResult?.success && projectResult.project?.path) {
          setProjectPath(projectResult.project.path)
        }

        // Load conversations from SQLite
        const result = await window.electronAPI?.chatWidget?.getConversations(currentProjectId)
        if (result?.success && result.conversations) {
          // Convert stored conversations to local format
          const loadedConversations: Conversation[] = await Promise.all(
            result.conversations.map(async (c: any) => {
              // Parse messages from JSON string if needed
              const messages = typeof c.messages === 'string'
                ? JSON.parse(c.messages)
                : (c.messages || [])

              // Convert timestamp numbers back to Date objects and load images
              const parsedMessages = await Promise.all(
                messages.map(async (m: any) => {
                  const msg: Message = {
                    ...m,
                    timestamp: new Date(m.timestamp)
                  }

                  // For image messages, reload the image from disk if it exists
                  if (m.type === 'image' && m.imageLocalPath) {
                    try {
                      const imageData = await window.electronAPI?.files?.readFileAsBase64(m.imageLocalPath)
                      if (imageData) {
                        msg.imageUrl = `data:image/png;base64,${imageData}`
                      }
                    } catch (err) {
                      // Image file might have been deleted - that's ok
                      console.log('Image file not found:', m.imageLocalPath)
                    }
                  }

                  return msg
                })
              )

              return {
                id: c.id,
                title: c.title,
                preview: parsedMessages.length > 0
                  ? parsedMessages[parsedMessages.length - 1].content?.slice(0, 40) + '...'
                  : '',
                timestamp: new Date(c.updatedAt),
                messages: parsedMessages,
                modelCategory: c.modelCategory || 'chat',
                model: c.model || 'gpt-4.1-mini'
              }
            })
          )
          setConversations(loadedConversations)

          // Select the most recent conversation if none is active
          if (loadedConversations.length > 0 && !activeConversation) {
            const mostRecent = loadedConversations[0]
            setActiveConversation(mostRecent)
            // Restore the model category and model from the conversation
            setModelCategory(mostRecent.modelCategory)
            if (mostRecent.modelCategory === 'chat') {
              setSelectedChatModel(mostRecent.model)
            } else {
              setSelectedImageModel(mostRecent.model)
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to load conversations:', err)
      }
    }
    loadConversations()
  }, [currentProjectId])

  // Set up stream listeners
  useEffect(() => {
    const handleStreamChunk = (chunk: string) => {
      setStreamingContent(prev => prev + chunk)
    }

    const handleStreamDone = () => {
      // Finalize the streamed message
      setStreamingContent(prev => {
        if (prev && activeConversation) {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: prev,
            timestamp: new Date(),
            type: 'text'
          }

          const updatedConversation = {
            ...activeConversation,
            messages: [...activeConversation.messages, aiMessage]
          }

          setActiveConversation(updatedConversation)
          setConversations(convs => convs.map(c => c.id === activeConversation.id ? updatedConversation : c))

          // Save to database
          window.electronAPI?.chatWidget?.updateConversation(
            activeConversation.id,
            updatedConversation.title,
            updatedConversation.messages
          ).catch(console.error)
        }
        return ''
      })
      setIsTyping(false)
    }

    const handleStreamError = (errorMsg: string) => {
      setError(errorMsg)
      setIsTyping(false)
      setStreamingContent('')
    }

    // Register listeners
    window.electronAPI?.chatWidget?.onStreamChunk(handleStreamChunk)
    window.electronAPI?.chatWidget?.onStreamDone(handleStreamDone)
    window.electronAPI?.chatWidget?.onStreamError(handleStreamError)

    return () => {
      window.electronAPI?.chatWidget?.removeStreamListeners()
    }
  }, [activeConversation])

  const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: chatWidgetSize.width,
      height: chatWidgetSize.height
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!headerRef.current?.contains(e.target as Node)) {
      return
    }

    setIsDragging(true)
    setDragOffset({
      x: e.clientX - chatWidgetPosition.x,
      y: e.clientY - chatWidgetPosition.y
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
        const maxX = window.innerWidth - chatWidgetSize.width - padding
        const minY = headerHeight
        const maxY = window.innerHeight - chatWidgetSize.height - bottomReservedArea - padding

        setChatWidgetPosition({
          x: Math.max(minX, Math.min(newX, maxX)),
          y: Math.max(minY, Math.min(newY, maxY))
        })
      } else if (isResizing && resizeDirection) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y

        let newWidth = resizeStart.width
        let newHeight = resizeStart.height
        let newX = chatWidgetPosition.x
        let newY = chatWidgetPosition.y

        if (resizeDirection === 'e') {
          newWidth = resizeStart.width + deltaX
        }
        if (resizeDirection === 'w') {
          newWidth = resizeStart.width - deltaX
          newX = chatWidgetPosition.x + deltaX
        }
        if (resizeDirection === 's') {
          newHeight = resizeStart.height + deltaY
        }
        if (resizeDirection === 'n') {
          newHeight = resizeStart.height - deltaY
          newY = chatWidgetPosition.y + deltaY
        }

        newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH))
        newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT))

        setChatWidgetSize({ width: newWidth, height: newHeight })

        if (resizeDirection === 'w' || resizeDirection === 'n') {
          setChatWidgetPosition({ x: newX, y: newY })
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
      setResizeDirection(null)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragOffset, resizeDirection, resizeStart, chatWidgetPosition, chatWidgetSize, setChatWidgetPosition, setChatWidgetSize])

  const handleSend = async () => {
    if (!message.trim() || !hasCurrentFeatureAccess) return

    setError(null)

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    }

    let currentConversation = activeConversation

    if (activeConversation) {
      // Add to existing conversation
      const updatedConversation = {
        ...activeConversation,
        messages: [...activeConversation.messages, newMessage],
        preview: message.trim().slice(0, 40) + '...',
        timestamp: new Date()
      }
      setActiveConversation(updatedConversation)
      setConversations(prev => prev.map(c => c.id === activeConversation.id ? updatedConversation : c))
      currentConversation = updatedConversation

      // Update in database
      window.electronAPI?.chatWidget?.updateConversation(
        activeConversation.id,
        updatedConversation.title,
        updatedConversation.messages
      ).catch(console.error)
    } else {
      // Create new conversation
      const newConversation: Conversation = {
        id: Date.now().toString(), // Temporary ID until we get the real one from DB
        title: message.trim().slice(0, 30) + (message.length > 30 ? '...' : ''),
        preview: message.trim().slice(0, 40) + '...',
        timestamp: new Date(),
        messages: [newMessage],
        modelCategory: modelCategory,
        model: selectedModel
      }
      setActiveConversation(newConversation)
      setConversations(prev => [newConversation, ...prev])
      currentConversation = newConversation

      // Save to database and get the real ID
      if (currentProjectId) {
        try {
          const result = await window.electronAPI?.chatWidget?.createConversation(
            currentProjectId,
            newConversation.title,
            newConversation.messages,
            newConversation.modelCategory,
            newConversation.model
          )
          if (result?.success && result.conversation?.id) {
            // Update local state with the database-generated ID
            const dbId = result.conversation.id
            const updatedConv = { ...newConversation, id: dbId }
            setActiveConversation(updatedConv)
            setConversations(prev => prev.map(c => c.id === newConversation.id ? updatedConv : c))
            currentConversation = updatedConv
          }
        } catch (err) {
          console.error('Failed to create conversation:', err)
        }
      }
    }

    const userPrompt = message.trim()
    setMessage('')
    setIsTyping(true)

    try {
      if (modelCategory === 'images') {
        // Image generation - direct response, not streaming
        if (!projectPath) {
          throw new Error('No project path available for saving images')
        }

        const result = await window.electronAPI?.chatWidget?.generateImage(
          projectPath,
          userPrompt,
          '1024x1024' // Default size
        )

        if (!result?.success) {
          throw new Error(result?.error || 'Image generation failed')
        }

        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Here\'s your generated image:',
          timestamp: new Date(),
          type: 'image',
          imageUrl: result.imageDataUrl, // Use base64 data URL for display
          imageLocalPath: result.localPath // Store local path for file operations
        }

        const updatedConversation = {
          ...currentConversation!,
          messages: [...currentConversation!.messages, aiResponse]
        }

        setActiveConversation(updatedConversation)
        setConversations(convs => convs.map(c => c.id === currentConversation!.id ? updatedConversation : c))

        // Save to database
        window.electronAPI?.chatWidget?.updateConversation(
          currentConversation!.id,
          updatedConversation.title,
          updatedConversation.messages
        ).catch(console.error)

        setIsTyping(false)
      } else {
        // Chat - streaming response
        const messagesToSend = currentConversation!.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))

        // Start streaming - chunks will be handled by the stream listeners
        await window.electronAPI?.chatWidget?.chat(messagesToSend, selectedModel)
        // Note: isTyping will be set to false by handleStreamDone or handleStreamError
      }
    } catch (err: any) {
      console.error('AI request failed:', err)
      setError(err.message || 'Request failed')
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const startNewConversation = () => {
    setActiveConversation(null)
    setMessage('')
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeConversation?.id === id) {
      setActiveConversation(null)
    }
    // Delete from database
    try {
      await window.electronAPI?.chatWidget?.deleteConversation(id)
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  return (
    <div
      ref={widgetRef}
      className="fixed bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 shadow-2xl overflow-hidden"
      style={{
        left: `${chatWidgetPosition.x}px`,
        top: `${chatWidgetPosition.y}px`,
        width: `${chatWidgetSize.width}px`,
        height: `${chatWidgetSize.height}px`,
        zIndex: chatWidgetZIndex
      }}
      onMouseDown={(e) => {
        bringWidgetToFront('chat')
        handleMouseDown(e)
      }}
    >
      {/* Background layers */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `url(${noiseBgImage})`,
          backgroundSize: 'cover',
          mixBlendMode: 'soft-light',
        }}
      />

      {/* History Sidebar - Slides in on hover */}
      <div
        className="absolute left-0 top-0 bottom-0 z-20"
        onMouseEnter={() => setShowHistory(true)}
        onMouseLeave={() => setShowHistory(false)}
      >
        {/* Trigger Area - Vertical Line */}
        <div className="absolute left-0 top-[37px] bottom-0 w-4 flex items-center justify-center cursor-pointer group">
          <div className="w-[3px] h-12 rounded-full bg-gray-600/50 group-hover:bg-cyan-500/70 group-hover:h-16 transition-all duration-200" />
        </div>

        {/* Sliding Panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ x: -220, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -220, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute left-0 top-[37px] bottom-0 w-[220px] bg-dark-bg/95 backdrop-blur-xl border-r border-dark-border/50 overflow-hidden"
            >
              {/* History Header */}
              <div className="p-3 border-b border-dark-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">History</span>
                  <button
                    onClick={startNewConversation}
                    className="p-1 rounded-md hover:bg-dark-card/50 transition-colors group"
                  >
                    <Plus size={14} className="text-gray-500 group-hover:text-cyan-400" />
                  </button>
                </div>
              </div>

              {/* Conversation List */}
              <div className="overflow-y-auto h-[calc(100%-52px)] scrollbar-thin">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center">
                    <MessageSquare size={24} className="mx-auto mb-2 text-gray-600" />
                    <p className="text-xs text-gray-500">No conversations yet</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => {
                          setActiveConversation(conv)
                          // Auto-select the model used in this conversation
                          setModelCategory(conv.modelCategory)
                          if (conv.modelCategory === 'chat') {
                            setSelectedChatModel(conv.model)
                          } else {
                            setSelectedImageModel(conv.model)
                          }
                        }}
                        className={`group p-2.5 rounded-lg cursor-pointer transition-all ${
                          activeConversation?.id === conv.id
                            ? conv.modelCategory === 'chat'
                              ? 'bg-cyan-500/10 border border-cyan-500/20'
                              : 'bg-purple-500/10 border border-purple-500/20'
                            : 'hover:bg-dark-card/50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${
                              activeConversation?.id === conv.id
                                ? conv.modelCategory === 'chat' ? 'text-cyan-400' : 'text-purple-400'
                                : 'text-gray-300'
                            }`}>
                              {conv.title}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">{conv.preview}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-[9px] text-gray-600">{formatRelativeTime(conv.timestamp)}</span>
                            <button
                              onClick={(e) => deleteConversation(conv.id, e)}
                              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                            >
                              <Trash2 size={10} className="text-gray-500 hover:text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div
        ref={headerRef}
        className="relative px-4 border-b border-dark-border/50 cursor-move select-none"
        style={{ minHeight: '37px', paddingTop: '6px', paddingBottom: '6px' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">Chat</h3>
          <button
            onClick={() => setChatWidgetEnabled(false)}
            className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X size={16} className="text-gray-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex flex-col" style={{ height: `calc(${chatWidgetSize.height}px - 37px)` }}>
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            // Empty state - dynamic based on category
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              {modelCategory === 'chat' ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center mb-4 relative">
                    <Sparkles size={28} className="text-cyan-400" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-dark-card border border-cyan-500/30 flex items-center justify-center">
                      {hasCurrentFeatureAccess ? (
                        <Bot size={12} className="text-cyan-400" />
                      ) : (
                        <Lock size={12} className="text-cyan-400" />
                      )}
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-200 mb-1">
                    Chat with <span className="text-cyan-400">{currentModelDisplay}</span>
                  </h4>
                  {hasCurrentFeatureAccess ? (
                    <>
                      <p className="text-sm text-gray-500 max-w-[260px] leading-relaxed">
                        Ask anything about your project — code, design, debugging, or ideas. I'm here to help.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 mt-4">
                        <span className="px-2 py-1 text-[10px] bg-cyan-500/10 text-cyan-400/70 rounded-full border border-cyan-500/20">Code review</span>
                        <span className="px-2 py-1 text-[10px] bg-cyan-500/10 text-cyan-400/70 rounded-full border border-cyan-500/20">Debug issues</span>
                        <span className="px-2 py-1 text-[10px] bg-cyan-500/10 text-cyan-400/70 rounded-full border border-cyan-500/20">Explain code</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 max-w-[260px] leading-relaxed mb-4">
                        Upgrade to <span className="text-cyan-400 font-medium">{requiredPlan}</span> to unlock AI chat and get help with your code.
                      </p>
                      <button
                        onClick={handleUpgrade}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-cyan-500/20"
                      >
                        <Crown size={14} />
                        Upgrade to {requiredPlan}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mb-4 relative">
                    <ImageIcon size={28} className="text-purple-400" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-dark-card border border-purple-500/30 flex items-center justify-center">
                      {hasCurrentFeatureAccess ? (
                        <Sparkles size={12} className="text-purple-400" />
                      ) : (
                        <Lock size={12} className="text-purple-400" />
                      )}
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-200 mb-1">
                    Create with <span className="text-purple-400">{currentModelDisplay}</span>
                  </h4>
                  {hasCurrentFeatureAccess ? (
                    <>
                      <p className="text-sm text-gray-500 max-w-[260px] leading-relaxed">
                        Describe your vision and watch it come to life. Generate stunning images in seconds.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 mt-4">
                        <span className="px-2 py-1 text-[10px] bg-purple-500/10 text-purple-400/70 rounded-full border border-purple-500/20">UI mockups</span>
                        <span className="px-2 py-1 text-[10px] bg-purple-500/10 text-purple-400/70 rounded-full border border-purple-500/20">Icons & logos</span>
                        <span className="px-2 py-1 text-[10px] bg-purple-500/10 text-purple-400/70 rounded-full border border-purple-500/20">Illustrations</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 max-w-[260px] leading-relaxed mb-4">
                        Upgrade to <span className="text-purple-400 font-medium">{requiredPlan}</span> to unlock AI image generation.
                      </p>
                      <button
                        onClick={handleUpgrade}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-purple-500/20"
                      >
                        <Crown size={14} />
                        Upgrade to {requiredPlan}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            // Messages
            <>
              {activeConversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30'
                      : msg.type === 'image'
                        ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                        : 'bg-gradient-to-br from-cyan-500/20 to-green-500/20 border border-cyan-500/30'
                  }`}>
                    {msg.role === 'user' ? (
                      <User size={14} className="text-blue-400" />
                    ) : msg.type === 'image' ? (
                      <ImageIcon size={14} className="text-purple-400" />
                    ) : (
                      <Bot size={14} className="text-cyan-400" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {/* Image Message */}
                    {msg.type === 'image' && msg.imageUrl ? (
                      <div className="inline-block text-left">
                        {/* Image Container */}
                        <div className="relative rounded-xl overflow-hidden border border-purple-500/30 bg-dark-bg/30">
                          <img
                            src={msg.imageUrl}
                            alt="Generated image"
                            className="max-w-[280px] max-h-[280px] object-cover"
                            loading="lazy"
                          />
                        </div>
                        {/* Footer - Timestamp left, Actions right */}
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <div className="flex items-center gap-1">
                            <Clock size={9} className="text-gray-600" />
                            <span className="text-[9px] text-gray-600">{formatRelativeTime(msg.timestamp)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={async () => {
                                // Show in Finder
                                if (msg.imageLocalPath) {
                                  await window.electronAPI?.shell?.showItemInFolder(msg.imageLocalPath)
                                }
                              }}
                              className="p-1.5 rounded-lg bg-dark-bg/50 border border-dark-border/50 hover:border-purple-500/30 hover:bg-purple-500/10 transition-all group"
                              title="Show in Finder"
                            >
                              <FolderOpen size={12} className="text-gray-500 group-hover:text-purple-400" />
                            </button>
                            <button
                              onClick={async () => {
                                // Save to project assets images folder
                                if (msg.imageLocalPath && currentProjectId) {
                                  try {
                                    // Get assets structure to find the images folder path
                                    const assetsResult = await window.electronAPI?.projects?.getAssetsStructure(currentProjectId)
                                    if (!assetsResult?.success || !assetsResult.assets) {
                                      throw new Error('Could not find assets folder')
                                    }

                                    // Find the "images" folder in assets
                                    const imagesFolder = assetsResult.assets.find((a: any) => a.name === 'images' && a.type === 'folder')
                                    if (!imagesFolder?.path) {
                                      throw new Error('Images folder not found in assets')
                                    }

                                    // Read the image file
                                    const imageData = await window.electronAPI?.files?.readFileAsBase64(msg.imageLocalPath)
                                    if (imageData) {
                                      const fileName = msg.imageLocalPath.split('/').pop() || `image_${Date.now()}.png`
                                      const destPath = `${imagesFolder.path}/${fileName}`

                                      // Save to assets
                                      await window.electronAPI?.files?.saveBase64Image(destPath, imageData)
                                      // Show checkmark briefly
                                      setSavedToAssetsId(msg.id)
                                      setTimeout(() => setSavedToAssetsId(null), 2000)
                                    }
                                  } catch (err: any) {
                                    console.error('Failed to save to assets:', err)
                                  }
                                }
                              }}
                              className={`p-1.5 rounded-lg bg-dark-bg/50 border transition-all group ${
                                savedToAssetsId === msg.id
                                  ? 'border-green-500/50 bg-green-500/10'
                                  : 'border-dark-border/50 hover:border-purple-500/30 hover:bg-purple-500/10'
                              }`}
                              title="Save to Assets"
                            >
                              {savedToAssetsId === msg.id ? (
                                <Check size={12} className="text-green-400" />
                              ) : (
                                <FolderPlus size={12} className="text-gray-500 group-hover:text-purple-400" />
                              )}
                            </button>
                            <button
                              onClick={async () => {
                                // Open image with default app
                                if (msg.imageLocalPath) {
                                  await window.electronAPI?.shell?.openPath(msg.imageLocalPath)
                                }
                              }}
                              className="p-1.5 rounded-lg bg-dark-bg/50 border border-dark-border/50 hover:border-purple-500/30 hover:bg-purple-500/10 transition-all group"
                              title="Open"
                            >
                              <ExternalLink size={12} className="text-gray-500 group-hover:text-purple-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Text Message */
                      <div className={`inline-flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`px-3 py-2 rounded-xl text-sm ${
                          msg.role === 'user'
                            ? 'bg-blue-500/20 border border-blue-500/30 text-gray-200'
                            : 'bg-dark-bg/50 border border-dark-border/50 text-gray-300'
                        }`}>
                          <p className="whitespace-pre-wrap text-left">{msg.content}</p>
                        </div>
                        <div className={`flex items-center gap-2 mt-1 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-between'}`}>
                          <div className="flex items-center gap-1">
                            <Clock size={9} className="text-gray-600" />
                            <span className="text-[9px] text-gray-600">{formatRelativeTime(msg.timestamp)}</span>
                          </div>
                          {msg.role === 'assistant' && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content)
                                setCopiedMessageId(msg.id)
                                setTimeout(() => setCopiedMessageId(null), 2000)
                              }}
                              className="p-1 rounded-md bg-dark-bg/50 border border-dark-border/50 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-all group"
                              title="Copy to clipboard"
                            >
                              {copiedMessageId === msg.id ? (
                                <Check size={10} className="text-green-400" />
                              ) : (
                                <Copy size={10} className="text-gray-500 group-hover:text-cyan-400" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator / Streaming content */}
              {isTyping && (
                <div className="flex gap-3">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                    modelCategory === 'images'
                      ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                      : 'bg-gradient-to-br from-cyan-500/20 to-green-500/20 border border-cyan-500/30'
                  }`}>
                    {modelCategory === 'images' ? (
                      <ImageIcon size={14} className="text-purple-400" />
                    ) : (
                      <Bot size={14} className="text-cyan-400" />
                    )}
                  </div>
                  <div className="flex-1 max-w-[85%]">
                    {streamingContent ? (
                      <div className="bg-dark-bg/50 border border-dark-border/50 px-3 py-2 rounded-xl">
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{streamingContent}</p>
                        <span className="inline-block w-2 h-4 bg-cyan-400/50 animate-pulse ml-0.5" />
                      </div>
                    ) : (
                      <div className="bg-dark-bg/50 border border-dark-border/50 px-4 py-3 rounded-xl">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error display */}
              {error && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center">
                    <AlertCircle size={14} className="text-red-400" />
                  </div>
                  <div className="flex-1 max-w-[85%]">
                    <div className="bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-xl">
                      <p className="text-sm text-red-400">{error}</p>
                      <button
                        onClick={() => setError(null)}
                        className="text-xs text-gray-500 hover:text-gray-300 mt-1"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 p-3 border-t border-dark-border/30 bg-dark-bg/20">
          <div className="flex items-center gap-2">
            {/* Model Selector */}
            <div className="relative flex-shrink-0" ref={modelDropdownRef}>
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                onMouseDown={(e) => e.stopPropagation()}
                className={`flex items-center justify-center gap-1.5 h-10 px-3 bg-dark-bg/50 border border-dark-border/50 rounded-xl transition-all group ${
                  modelCategory === 'chat'
                    ? 'hover:border-cyan-500/30'
                    : 'hover:border-purple-500/30'
                }`}
              >
                {modelCategory === 'chat' ? (
                  <Sparkles size={13} className="text-cyan-400" />
                ) : (
                  <ImageIcon size={13} className="text-purple-400" />
                )}
                <span className="text-[11px] text-gray-300 font-medium">{currentModelDisplay}</span>
                <ChevronDown size={10} className="text-gray-500" />
              </button>

              {/* Dropdown */}
              <AnimatePresence>
                {showModelDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 mb-1 w-52 bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden z-50"
                  >
                    <div
                      className="absolute inset-0 opacity-10 pointer-events-none"
                      style={{
                        backgroundImage: `url(${bgImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />

                    {/* Category Tabs */}
                    <div className="relative flex border-b border-dark-border/50">
                      <button
                        onClick={() => setModelCategory('chat')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all ${
                          modelCategory === 'chat'
                            ? 'text-cyan-400 bg-cyan-500/10 border-b-2 border-cyan-400'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-dark-bg/30'
                        }`}
                      >
                        <Sparkles size={12} />
                        <span>Chat</span>
                      </button>
                      <button
                        onClick={() => setModelCategory('images')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all ${
                          modelCategory === 'images'
                            ? 'text-purple-400 bg-purple-500/10 border-b-2 border-purple-400'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-dark-bg/30'
                        }`}
                      >
                        <ImageIcon size={12} />
                        <span>Images</span>
                      </button>
                    </div>

                    {/* Model List */}
                    <div className="relative p-1.5 space-y-0.5">
                      {currentModels.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id)
                            setShowModelDropdown(false)

                            // Start new conversation if model or category changed from active conversation
                            if (activeConversation && activeConversation.messages.length > 0) {
                              const categoryChanged = modelCategory !== activeConversation.modelCategory
                              const modelChanged = model.id !== activeConversation.model
                              if (categoryChanged || modelChanged) {
                                setActiveConversation(null)
                                setMessage('')
                              }
                            }
                          }}
                          className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
                            selectedModel === model.id
                              ? modelCategory === 'chat'
                                ? 'bg-cyan-500/15 border border-cyan-500/30'
                                : 'bg-purple-500/15 border border-purple-500/30'
                              : 'hover:bg-dark-bg/50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-medium ${
                              selectedModel === model.id
                                ? modelCategory === 'chat' ? 'text-cyan-400' : 'text-purple-400'
                                : 'text-gray-300'
                            }`}>
                              {model.displayName}
                            </span>
                            {selectedModel === model.id && (
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                modelCategory === 'chat' ? 'bg-cyan-400' : 'bg-purple-400'
                              }`} />
                            )}
                          </div>
                          <p className="text-[9px] text-gray-500 mt-0.5">{model.description}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input Box - Disabled with upgrade prompt when no access */}
            {hasCurrentFeatureAccess ? (
              <div className="relative flex-1 flex items-center">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder={modelCategory === 'chat' ? 'Ask anything...' : 'Describe your vision...'}
                  rows={1}
                  className={`w-full h-10 bg-dark-bg/60 border border-dark-border/50 rounded-xl px-3 pr-10 text-sm text-white placeholder-gray-500 outline-none resize-none transition-colors scrollbar-hide flex items-center ${
                    modelCategory === 'chat' ? 'focus:border-cyan-500/50' : 'focus:border-purple-500/50'
                  }`}
                  style={{ paddingTop: '10px', paddingBottom: '10px', maxHeight: '100px' }}
                />
                <button
                  onClick={handleSend}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={!message.trim()}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                    message.trim()
                      ? modelCategory === 'chat'
                        ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                        : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                      : 'text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <Send size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleUpgrade}
                onMouseDown={(e) => e.stopPropagation()}
                className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-xl border transition-all ${
                  modelCategory === 'chat'
                    ? 'bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400'
                    : 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-400'
                }`}
              >
                <Lock size={14} />
                <span className="text-sm font-medium">Upgrade to {requiredPlan} to unlock</span>
              </button>
            )}

            {/* New Chat Button */}
            {activeConversation && (
              <button
                onClick={startNewConversation}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-dark-bg/50 border border-dark-border/50 rounded-xl hover:border-cyan-500/30 hover:bg-dark-bg/70 transition-all group"
                title="New chat"
              >
                <Plus size={16} className="text-gray-500 group-hover:text-cyan-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resize Handles */}
      <div
        onMouseDown={(e) => handleResizeStart(e, 'n')}
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10"
      />
      <div
        onMouseDown={(e) => handleResizeStart(e, 's')}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-10"
      />
      <div
        onMouseDown={(e) => handleResizeStart(e, 'e')}
        className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize z-10"
      />
      <div
        onMouseDown={(e) => handleResizeStart(e, 'w')}
        className="absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize z-10"
      />
    </div>
  )
}

export default ChatWidget
