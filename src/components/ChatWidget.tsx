import { useState, useRef, useEffect } from 'react'
import { X, Send, ChevronDown, Plus, Sparkles, User, Bot, Clock, Trash2, MessageSquare, Image as ImageIcon, Download, FolderPlus, ExternalLink, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLayoutStore } from '../store/layoutStore'
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

// Placeholder conversations for demo
const PLACEHOLDER_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    title: 'Landing page hero section',
    preview: 'Create a modern hero section with...',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    modelCategory: 'chat',
    model: 'claude-sonnet-4-5-20250929',
    messages: [
      { id: '1a', role: 'user', content: 'Create a modern hero section with a gradient background and animated text', timestamp: new Date(Date.now() - 1000 * 60 * 35) },
      { id: '1b', role: 'assistant', content: 'I\'ll create a stunning hero section with a smooth gradient and text animations. Here\'s what I\'m implementing:\n\n1. A dynamic gradient background transitioning from purple to blue\n2. Fade-in animations for the headline\n3. A floating CTA button with hover effects\n\nLet me add this to your code...', timestamp: new Date(Date.now() - 1000 * 60 * 34) },
      { id: '1c', role: 'user', content: 'Perfect! Can you also add a subtle particle effect?', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
    ]
  },
  {
    id: '2',
    title: 'API integration help',
    preview: 'How do I connect to the...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    modelCategory: 'chat',
    model: 'claude-opus-4-1-20250805',
    messages: [
      { id: '2a', role: 'user', content: 'How do I connect to the Stripe API for payments?', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
      { id: '2b', role: 'assistant', content: 'I\'ll help you integrate Stripe for payments. First, you\'ll need to:\n\n1. Install the Stripe SDK: `npm install stripe @stripe/stripe-js`\n2. Set up your API keys in environment variables\n3. Create a payment intent endpoint\n\nWould you like me to implement this now?', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2 + 1000 * 60) },
    ]
  },
  {
    id: '3',
    title: 'App icon design',
    preview: 'Generate a modern app icon...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    modelCategory: 'images',
    model: 'dall-e-3',
    messages: [
      { id: '3a', role: 'user', content: 'Generate a modern app icon for a productivity app, minimalist style', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) },
      { id: '3b', role: 'assistant', content: 'Here\'s your generated image:', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 + 1000 * 30), type: 'image', imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=512&h=512&fit=crop' },
    ]
  },
  {
    id: '4',
    title: 'Performance optimization',
    preview: 'My app is running slow...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    modelCategory: 'chat',
    model: 'claude-haiku-4-5-20251001',
    messages: [
      { id: '4a', role: 'user', content: 'My app is running slow, can you help optimize it?', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) },
      { id: '4b', role: 'assistant', content: 'Let me analyze your codebase for performance issues. I\'ll check for:\n\n1. Unnecessary re-renders\n2. Large bundle sizes\n3. Unoptimized images\n4. Memory leaks\n\nRunning analysis...', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3 + 1000 * 60) },
    ]
  },
]

type ModelCategory = 'chat' | 'images'

const CHAT_MODELS = [
  { value: 'claude-sonnet-4-5-20250929', displayName: 'Sonnet 4.5', description: 'Fast & capable' },
  { value: 'claude-opus-4-1-20250805', displayName: 'Opus 4.1', description: 'Most powerful' },
  { value: 'claude-haiku-4-5-20251001', displayName: 'Haiku 4.5', description: 'Lightning fast' },
]

const IMAGE_MODELS = [
  { value: 'dall-e-3', displayName: 'DALL-E 3', description: 'Best quality' },
  { value: 'stable-diffusion-xl', displayName: 'SDXL', description: 'Fast & flexible' },
  { value: 'midjourney-v6', displayName: 'Midjourney', description: 'Artistic style' },
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

  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })

  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>(PLACEHOLDER_CONVERSATIONS)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(PLACEHOLDER_CONVERSATIONS[0])
  const [message, setMessage] = useState('')
  const [modelCategory, setModelCategory] = useState<ModelCategory>('chat')
  const [selectedChatModel, setSelectedChatModel] = useState('claude-sonnet-4-5-20250929')
  const [selectedImageModel, setSelectedImageModel] = useState('dall-e-3')
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  // Get current model based on category
  const currentModels = modelCategory === 'chat' ? CHAT_MODELS : IMAGE_MODELS
  const selectedModel = modelCategory === 'chat' ? selectedChatModel : selectedImageModel
  const setSelectedModel = modelCategory === 'chat' ? setSelectedChatModel : setSelectedImageModel
  const currentModelDisplay = currentModels.find(m => m.value === selectedModel)?.displayName || 'Select'

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
    if (!message.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    }

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
    } else {
      // Create new conversation
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: message.trim().slice(0, 30) + (message.length > 30 ? '...' : ''),
        preview: message.trim().slice(0, 40) + '...',
        timestamp: new Date(),
        messages: [newMessage],
        modelCategory: modelCategory,
        model: selectedModel
      }
      setActiveConversation(newConversation)
      setConversations(prev => [newConversation, ...prev])
    }

    setMessage('')

    // Simulate AI response
    setIsTyping(true)
    setTimeout(() => {
      const aiResponse: Message = modelCategory === 'images'
        ? {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Here\'s your generated image:',
            timestamp: new Date(),
            type: 'image',
            // Placeholder image URL - will be replaced with actual generated image
            imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=512&h=512&fit=crop'
          }
        : {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'This is a placeholder response. The AI chat functionality will be implemented soon. For now, you can see how the interface works!',
            timestamp: new Date(),
            type: 'text'
          }

      setActiveConversation(prev => {
        if (!prev) return prev
        const updated = {
          ...prev,
          messages: [...prev.messages, aiResponse]
        }
        setConversations(convs => convs.map(c => c.id === prev.id ? updated : c))
        return updated
      })
      setIsTyping(false)
    }, 1500)
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

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeConversation?.id === id) {
      setActiveConversation(null)
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
                      <Bot size={12} className="text-cyan-400" />
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-200 mb-1">
                    Chat with <span className="text-cyan-400">{currentModelDisplay}</span>
                  </h4>
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
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mb-4 relative">
                    <ImageIcon size={28} className="text-purple-400" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-dark-card border border-purple-500/30 flex items-center justify-center">
                      <Sparkles size={12} className="text-purple-400" />
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-200 mb-1">
                    Create with <span className="text-purple-400">{currentModelDisplay}</span>
                  </h4>
                  <p className="text-sm text-gray-500 max-w-[260px] leading-relaxed">
                    Describe your vision and watch it come to life. Generate stunning images in seconds.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <span className="px-2 py-1 text-[10px] bg-purple-500/10 text-purple-400/70 rounded-full border border-purple-500/20">UI mockups</span>
                    <span className="px-2 py-1 text-[10px] bg-purple-500/10 text-purple-400/70 rounded-full border border-purple-500/20">Icons & logos</span>
                    <span className="px-2 py-1 text-[10px] bg-purple-500/10 text-purple-400/70 rounded-full border border-purple-500/20">Illustrations</span>
                  </div>
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
                              onClick={() => {
                                // Download image
                                const link = document.createElement('a')
                                link.href = msg.imageUrl!
                                link.download = `generated-${msg.id}.png`
                                link.click()
                              }}
                              className="p-1.5 rounded-lg bg-dark-bg/50 border border-dark-border/50 hover:border-purple-500/30 hover:bg-purple-500/10 transition-all group"
                              title="Download"
                            >
                              <Download size={12} className="text-gray-500 group-hover:text-purple-400" />
                            </button>
                            <button
                              onClick={() => {
                                // Save to project assets
                                console.log('Save to assets:', msg.imageUrl)
                              }}
                              className="p-1.5 rounded-lg bg-dark-bg/50 border border-dark-border/50 hover:border-purple-500/30 hover:bg-purple-500/10 transition-all group"
                              title="Save to Assets"
                            >
                              <FolderPlus size={12} className="text-gray-500 group-hover:text-purple-400" />
                            </button>
                            <button
                              onClick={() => {
                                // Open in new tab
                                window.open(msg.imageUrl, '_blank')
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

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-green-500/20 border border-cyan-500/30 flex items-center justify-center">
                    <Bot size={14} className="text-cyan-400" />
                  </div>
                  <div className="bg-dark-bg/50 border border-dark-border/50 px-4 py-3 rounded-xl">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                          key={model.value}
                          onClick={() => {
                            setSelectedModel(model.value)
                            setShowModelDropdown(false)

                            // Start new conversation if model or category changed from active conversation
                            if (activeConversation && activeConversation.messages.length > 0) {
                              const categoryChanged = modelCategory !== activeConversation.modelCategory
                              const modelChanged = model.value !== activeConversation.model
                              if (categoryChanged || modelChanged) {
                                setActiveConversation(null)
                                setMessage('')
                              }
                            }
                          }}
                          className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
                            selectedModel === model.value
                              ? modelCategory === 'chat'
                                ? 'bg-cyan-500/15 border border-cyan-500/30'
                                : 'bg-purple-500/15 border border-purple-500/30'
                              : 'hover:bg-dark-bg/50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-medium ${
                              selectedModel === model.value
                                ? modelCategory === 'chat' ? 'text-cyan-400' : 'text-purple-400'
                                : 'text-gray-300'
                            }`}>
                              {model.displayName}
                            </span>
                            {selectedModel === model.value && (
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

            {/* Input Box */}
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
