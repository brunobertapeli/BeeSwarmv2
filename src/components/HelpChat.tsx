import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Sparkles, ChevronDown, ArrowLeft, Bug, Mail } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import bgImage from '../assets/images/bg.jpg'

interface FAQItem {
  question: string
  answer: string
}

type ViewMode = 'chat' | 'bug-report' | 'offline-message'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  faqItems?: FAQItem[]
  isCommandList?: boolean
}

interface HelpChatProps {
  projectId?: string
}

function HelpChat({ projectId }: HelpChatProps) {
  const { user, currentProjectId } = useAppStore()
  const { setModalFreezeActive, setModalFreezeImage, layoutState } = useLayoutStore()
  const [isOpen, setIsOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [expandedFAQs, setExpandedFAQs] = useState<Set<number>>(new Set())

  // Bug report form state
  const [bugType, setBugType] = useState<'ui' | 'functionality' | 'performance' | 'crash' | 'templates' | 'other'>('functionality')
  const [bugTitle, setBugTitle] = useState('')
  const [bugDescription, setBugDescription] = useState('')
  const [bugSteps, setBugSteps] = useState('')
  const [isSubmittingBug, setIsSubmittingBug] = useState(false)

  // Offline message form state
  const [offlineSubject, setOfflineSubject] = useState('')
  const [offlineMessage, setOfflineMessage] = useState('')
  const [isSubmittingOffline, setIsSubmittingOffline] = useState(false)

  // Support session state
  const [isInQueue, setIsInQueue] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [hasNewMessages, setHasNewMessages] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      const maxHeight = 4 * 24 // 4 lines * 24px line height
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`
    }
  }, [inputMessage])

  // Poll for new support messages when in queue
  useEffect(() => {
    if (!isInQueue || !user) return

    const checkForNewMessages = async () => {
      try {
        const result = await window.electronAPI?.support.getSession(user.id)

        if (result?.success && result.session) {
          const supportMessages = result.session.messages.filter((msg: any) => msg.type === 'support')

          // Count unread support messages
          const unread = supportMessages.filter((msg: any) => !msg.read).length

          if (unread > 0 && !isOpen) {
            setUnreadCount(unread)
            setHasNewMessages(true)

            // Add new support messages to chat
            supportMessages.forEach((msg: any) => {
              const existingMessage = messages.find(m => m.id === msg._id?.toString())
              if (!existingMessage) {
                const newMessage: Message = {
                  id: msg._id?.toString() || `msg-${Date.now()}`,
                  type: 'assistant',
                  content: msg.content,
                  timestamp: new Date(msg.timestamp)
                }
                setMessages(prev => [...prev, newMessage])
              }
            })
          } else if (unread === 0 && isOpen) {
            // User opened chat, reset counters
            setUnreadCount(0)
            setHasNewMessages(false)
          }
        }
      } catch (error) {
        console.error('Failed to check for new messages:', error)
      }
    }

    // Check immediately
    checkForNewMessages()

    // Poll every 5 seconds
    pollingIntervalRef.current = setInterval(checkForNewMessages, 5000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [isInQueue, user, isOpen, messages])

  // Reset unread count when chat is opened
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      setUnreadCount(0)
      setHasNewMessages(false)
    }
  }, [isOpen])

  // Handle freeze frame when HelpChat opens/closes
  useEffect(() => {
    const activeProjectId = projectId || currentProjectId

    const handleFreezeFrame = async () => {
      if (isOpen && activeProjectId) {
        // Only freeze if in DEFAULT state (browser is visible)
        if (layoutState === 'DEFAULT') {
          const result = await window.electronAPI?.layout.captureModalFreeze(activeProjectId)
          if (result?.success && result.freezeImage) {
            setModalFreezeImage(result.freezeImage)
            setModalFreezeActive(true)
            await window.electronAPI?.preview.hide(activeProjectId)
          }
        }
      } else {
        // Closing HelpChat - deactivate freeze frame
        setModalFreezeActive(false)
        // Only show browser back if in DEFAULT state
        if (activeProjectId && layoutState === 'DEFAULT') {
          await window.electronAPI?.preview.show(activeProjectId)
        }
      }
    }

    handleFreezeFrame()
  }, [isOpen, projectId, currentProjectId, layoutState, setModalFreezeActive, setModalFreezeImage])

  const FAQ_ITEMS: FAQItem[] = [
    {
      question: "How do I create a new project?",
      answer: "Click the project name in the header and select 'Create New Project'. Choose from our templates like React, Vue, or Next.js, then follow the setup wizard."
    },
    {
      question: "How can I change the preview size?",
      answer: "Use the buttons in the top bar of the preview window: Full Screen, Large (80%), or Medium (66%). You can also switch between desktop and mobile views."
    },
    {
      question: "What is Claude and how do I use it?",
      answer: "Claude is your AI coding assistant. Type your request in the action bar at the bottom, and Claude will help you build features, fix bugs, and write code automatically."
    },
    {
      question: "How do I deploy my project?",
      answer: "Connect your Netlify account in Settings, then click the Deploy button in the action bar. Your project will be built and deployed automatically."
    },
    {
      question: "Can I open the terminal?",
      answer: "Yes! Click the Terminal icon in the action bar to open a full terminal for your project. You can run any commands you need."
    },
    {
      question: "How do I manage my context with Claude?",
      answer: "The context bar shows your token usage. Hover over it to see details and clear context if needed. This helps manage Claude's conversation memory."
    },
    {
      question: "What models are available?",
      answer: "Click the model selector in the action bar to choose between Sonnet (balanced), Opus (most capable), or Haiku (fastest). Each has different capabilities and speeds."
    },
    {
      question: "How do I switch between projects?",
      answer: "Click your project name in the header to open the project selector. You can switch between existing projects or create new ones."
    },
    {
      question: "Can I view mobile responsiveness?",
      answer: "Absolutely! Click the Mobile button in the action bar, then use the device selector to preview on different phones (iPhone, Galaxy, etc.) in portrait or landscape."
    },
    {
      question: "How do I see the conversation history with Claude?",
      answer: "The status sheet above the action bar shows your complete interaction timeline, including messages, deployments, and actions. Click to expand for full details."
    }
  ]

  const handleSend = async () => {
    if (!inputMessage.trim()) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsTyping(true)

    // Handle special commands
    const message = inputMessage.trim().toLowerCase()

    // Handle /human command separately (needs async)
    if (message === '/human') {
      (async () => {
        try {
          const availabilityResult = await window.electronAPI?.support.checkAvailability()

          if (availabilityResult?.success && availabilityResult.available) {
            // Support is online - add to queue
            if (user) {
              const queueResult = await window.electronAPI?.support.addToQueue({
                userId: user.id,
                userName: user.name,
                userEmail: user.email,
                projectId,
                lastMessage: inputMessage
              })

              if (queueResult?.success) {
                const assistantMessage: Message = {
                  id: `msg-${Date.now()}-assistant`,
                  type: 'assistant',
                  content: '🎉 You\'ve been added to the support queue! A human agent will connect with you shortly.\n\nYou can minimize this chat - the help button will notify you when support responds.',
                  timestamp: new Date()
                }
                setMessages(prev => [...prev, assistantMessage])
                setIsInQueue(true) // Start polling for responses
              }
            }
            setIsTyping(false)
          } else {
            // Support is offline - show offline message form
            setIsTyping(false)
            setViewMode('offline-message')
          }
        } catch (error) {
          console.error('Failed to check support availability:', error)
          const assistantMessage: Message = {
            id: `msg-${Date.now()}-assistant`,
            type: 'assistant',
            content: 'Sorry, we\'re having trouble connecting to support right now. Please try again later.',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, assistantMessage])
          setIsTyping(false)
        }
      })()
      return
    }

    setTimeout(() => {
      let assistantMessage: Message

      if (message === '/faq') {
        assistantMessage = {
          id: `msg-${Date.now()}-assistant`,
          type: 'assistant',
          content: 'Here are some frequently asked questions:',
          timestamp: new Date(),
          faqItems: FAQ_ITEMS
        }
      } else if (message === '/discord') {
        window.electronAPI?.shell.openExternal('https://discord.com')
        assistantMessage = {
          id: `msg-${Date.now()}-assistant`,
          type: 'assistant',
          content: 'Opening Discord... Join our community for support and discussions!',
          timestamp: new Date()
        }
      } else if (message === '/bugreport') {
        // Open bug report form
        setViewMode('bug-report')
        setIsTyping(false)
        return
      } else if (message === '/commands') {
        assistantMessage = {
          id: `msg-${Date.now()}-assistant`,
          type: 'assistant',
          content: 'Available commands:',
          timestamp: new Date(),
          isCommandList: true
        }
      } else {
        // AI response placeholder
        assistantMessage = {
          id: `msg-${Date.now()}-assistant`,
          type: 'assistant',
          content: `I received your message: "${inputMessage}". Our AI assistant is being integrated. For now, try /commands to see available commands!`,
          timestamp: new Date()
        }
      }

      setMessages(prev => [...prev, assistantMessage])
      setIsTyping(false)
      setExpandedFAQs(new Set()) // Reset expanded FAQs when new message arrives
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSubmitBugReport = async () => {
    if (!bugTitle.trim() || !bugDescription.trim() || !user) return

    setIsSubmittingBug(true)

    try {
      const result = await window.electronAPI?.support.submitBugReport({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        projectId,
        bugType,
        title: bugTitle.trim(),
        description: bugDescription.trim(),
        stepsToReproduce: bugSteps.trim() || undefined
      })

      if (result?.success) {
        // Reset form
        setBugTitle('')
        setBugDescription('')
        setBugSteps('')
        setBugType('functionality')

        // Show success message in chat
        const successMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          type: 'assistant',
          content: 'Thank you for reporting this bug! Our team will review and fix it as soon as possible. We\'ll keep you updated via email.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, successMessage])

        // Return to chat view
        setViewMode('chat')
      }
    } catch (error) {
      console.error('Failed to submit bug report:', error)
    } finally {
      setIsSubmittingBug(false)
    }
  }

  const handleSubmitOfflineMessage = async () => {
    if (!offlineSubject.trim() || !offlineMessage.trim() || !user) return

    setIsSubmittingOffline(true)

    try {
      const result = await window.electronAPI?.support.sendOfflineMessage({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        projectId,
        subject: offlineSubject.trim(),
        message: offlineMessage.trim()
      })

      if (result?.success) {
        // Reset form
        setOfflineSubject('')
        setOfflineMessage('')

        // Show success message in chat
        const successMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          type: 'assistant',
          content: 'Thank you for your message! Our support team is currently offline, but we\'ll get back to you via email as soon as possible.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, successMessage])

        // Return to chat view
        setViewMode('chat')
      }
    } catch (error) {
      console.error('Failed to send offline message:', error)
    } finally {
      setIsSubmittingOffline(false)
    }
  }

  return (
    <>
      {/* Floating Help Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full bg-dark-card/50 backdrop-blur-xl border border-dark-border/50 shadow-2xl flex items-center justify-center transition-all duration-300 hover:bg-dark-card hover:border-primary/50 hover:scale-110 group ${
          hasNewMessages ? 'animate-bounce' : ''
        }`}
        title="Help & Support"
      >
        {isOpen ? (
          <X size={20} className="text-gray-400 group-hover:text-primary transition-colors" />
        ) : (
          <MessageCircle size={20} className="text-gray-400 group-hover:text-primary transition-colors" />
        )}

        {/* Badge for unread messages */}
        {!isOpen && unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">{unreadCount}</span>
          </div>
        )}
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] w-[400px] h-[600px] animate-scaleIn">
          <div className="bg-dark-card/95 backdrop-blur-xl border border-dark-border rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full relative">
            {/* Background Image */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Header */}
            <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                {viewMode !== 'chat' && (
                  <button
                    onClick={() => setViewMode('chat')}
                    className="p-1 hover:bg-dark-bg/50 rounded transition-colors mr-1"
                  >
                    <ArrowLeft size={16} className="text-gray-400 hover:text-white transition-colors" />
                  </button>
                )}
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  {viewMode === 'bug-report' ? (
                    <Bug size={16} className="text-primary" />
                  ) : viewMode === 'offline-message' ? (
                    <Mail size={16} className="text-primary" />
                  ) : (
                    <Sparkles size={16} className="text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {viewMode === 'bug-report' ? 'Report a Bug' : viewMode === 'offline-message' ? 'Send Message' : 'Help & Support'}
                  </h3>
                  <p className="text-[10px] text-gray-500">
                    {viewMode === 'bug-report' ? 'Help us fix issues' : viewMode === 'offline-message' ? 'We\'ll get back to you' : 'We\'re here to help'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-dark-bg/50 rounded transition-colors"
              >
                <X size={16} className="text-gray-400 hover:text-white transition-colors" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 relative z-10 custom-scrollbar">
              {viewMode === 'bug-report' ? (
                // Bug Report Form
                <div className="space-y-4">
                  {/* Bug Type Selector */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">Bug Type *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['ui', 'functionality', 'performance', 'crash', 'templates', 'other'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setBugType(type)}
                          className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                            bugType === type
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-dark-bg/30 border-dark-border/50 text-gray-300 hover:border-primary/30'
                          }`}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">Title *</label>
                    <input
                      type="text"
                      value={bugTitle}
                      onChange={(e) => setBugTitle(e.target.value)}
                      placeholder="Brief description of the bug"
                      className="w-full bg-dark-bg/50 text-white placeholder-gray-500 text-xs rounded-lg px-3 py-2 border border-dark-border/50 focus:border-primary/30 outline-none"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">Description *</label>
                    <textarea
                      value={bugDescription}
                      onChange={(e) => setBugDescription(e.target.value)}
                      placeholder="Describe the bug in detail"
                      className="w-full h-24 bg-dark-bg/50 text-white placeholder-gray-500 text-xs rounded-lg px-3 py-2 border border-dark-border/50 focus:border-primary/30 outline-none resize-none"
                    />
                  </div>

                  {/* Steps to Reproduce */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">Steps to Reproduce</label>
                    <textarea
                      value={bugSteps}
                      onChange={(e) => setBugSteps(e.target.value)}
                      placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                      className="w-full h-20 bg-dark-bg/50 text-white placeholder-gray-500 text-xs rounded-lg px-3 py-2 border border-dark-border/50 focus:border-primary/30 outline-none resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmitBugReport}
                    disabled={!bugTitle.trim() || !bugDescription.trim() || isSubmittingBug}
                    className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {isSubmittingBug ? 'Submitting...' : 'Submit Bug Report'}
                  </button>
                </div>
              ) : viewMode === 'offline-message' ? (
                // Offline Message Form
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-yellow-500/10 flex items-center justify-center">
                      <Mail size={24} className="text-yellow-400" />
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-1">Support Offline</h4>
                    <p className="text-xs text-gray-400">Our support team will get back to you via email</p>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">Subject *</label>
                    <input
                      type="text"
                      value={offlineSubject}
                      onChange={(e) => setOfflineSubject(e.target.value)}
                      placeholder="What do you need help with?"
                      className="w-full bg-dark-bg/50 text-white placeholder-gray-500 text-xs rounded-lg px-3 py-2 border border-dark-border/50 focus:border-primary/30 outline-none"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">Message *</label>
                    <textarea
                      value={offlineMessage}
                      onChange={(e) => setOfflineMessage(e.target.value)}
                      placeholder="Please describe your issue or question in detail..."
                      className="w-full h-32 bg-dark-bg/50 text-white placeholder-gray-500 text-xs rounded-lg px-3 py-2 border border-dark-border/50 focus:border-primary/30 outline-none resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmitOfflineMessage}
                    disabled={!offlineSubject.trim() || !offlineMessage.trim() || isSubmittingOffline}
                    className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {isSubmittingOffline ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              ) : messages.length === 0 ? (
                // Welcome Tips
                <div className="space-y-3">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles size={24} className="text-primary" />
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-1">Welcome to Support</h4>
                    <p className="text-xs text-gray-400">How can we help you today?</p>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-3">
                      <p className="text-xs text-gray-300">
                        <span className="font-mono text-primary">/faq</span>
                        <span className="text-gray-500"> - </span>
                        View frequently asked questions
                      </p>
                    </div>

                    <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-3">
                      <p className="text-xs text-gray-300">
                        <span className="font-mono text-primary">/commands</span>
                        <span className="text-gray-500"> - </span>
                        Show all available commands
                      </p>
                    </div>

                    <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-3">
                      <p className="text-xs text-gray-300">
                        <span className="font-mono text-primary">/discord</span>
                        <span className="text-gray-500"> - </span>
                        Join our Discord community
                      </p>
                    </div>

                    <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-3">
                      <p className="text-xs text-gray-300">
                        <span className="font-mono text-primary">/human</span>
                        <span className="text-gray-500"> - </span>
                        Connect with a support agent
                      </p>
                    </div>

                    <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-3">
                      <p className="text-xs text-gray-300">
                        <span className="font-mono text-primary">/bugreport</span>
                        <span className="text-gray-500"> - </span>
                        Report a bug or issue
                      </p>
                    </div>

                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                      <p className="text-xs text-gray-300">
                        Or simply ask anything, and our AI assistant will help you!
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                // Messages
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`${message.type === 'user' ? 'max-w-[80%]' : 'w-full'} rounded-lg ${
                          message.type === 'user'
                            ? 'bg-primary text-white px-3 py-2'
                            : 'bg-dark-bg/50 border border-dark-border/50 text-gray-200'
                        }`}
                      >
                        {message.type === 'user' ? (
                          // User message
                          <>
                            <p className="text-xs leading-relaxed">{message.content}</p>
                            <p className="text-[10px] mt-1 text-white/60">
                              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </>
                        ) : (
                          // Assistant message
                          <div className="px-3 py-2">
                            <p className="text-xs leading-relaxed whitespace-pre-line">{message.content}</p>

                            {/* FAQ Items */}
                            {message.faqItems && message.faqItems.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {message.faqItems.map((faq, index) => (
                                  <div
                                    key={index}
                                    className="bg-dark-bg/50 border border-dark-border/30 rounded-lg overflow-hidden"
                                  >
                                    <button
                                      onClick={() => {
                                        const newExpanded = new Set(expandedFAQs)
                                        if (newExpanded.has(index)) {
                                          newExpanded.delete(index)
                                        } else {
                                          newExpanded.add(index)
                                        }
                                        setExpandedFAQs(newExpanded)
                                      }}
                                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-dark-bg/30 transition-colors"
                                    >
                                      <span className="text-xs font-medium text-gray-200 text-left">
                                        {faq.question}
                                      </span>
                                      <ChevronDown
                                        size={14}
                                        className={`text-gray-400 flex-shrink-0 ml-2 transition-transform duration-200 ${
                                          expandedFAQs.has(index) ? 'rotate-180' : ''
                                        }`}
                                      />
                                    </button>
                                    {expandedFAQs.has(index) && (
                                      <div className="px-3 py-2 border-t border-dark-border/30 bg-dark-bg/20">
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                          {faq.answer}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Command List */}
                            {message.isCommandList && (
                              <div className="mt-3 space-y-2">
                                <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
                                  <p className="text-xs text-gray-300">
                                    <span className="font-mono text-primary">/faq</span>
                                    <span className="text-gray-500"> - </span>
                                    View frequently asked questions
                                  </p>
                                </div>
                                <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
                                  <p className="text-xs text-gray-300">
                                    <span className="font-mono text-primary">/commands</span>
                                    <span className="text-gray-500"> - </span>
                                    Show all available commands
                                  </p>
                                </div>
                                <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
                                  <p className="text-xs text-gray-300">
                                    <span className="font-mono text-primary">/discord</span>
                                    <span className="text-gray-500"> - </span>
                                    Join our Discord community
                                  </p>
                                </div>
                                <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
                                  <p className="text-xs text-gray-300">
                                    <span className="font-mono text-primary">/human</span>
                                    <span className="text-gray-500"> - </span>
                                    Connect with a support agent
                                  </p>
                                </div>
                                <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
                                  <p className="text-xs text-gray-300">
                                    <span className="font-mono text-primary">/bugreport</span>
                                    <span className="text-gray-500"> - </span>
                                    Report a bug or issue
                                  </p>
                                </div>
                              </div>
                            )}

                            <p className="text-[10px] mt-2 text-gray-500">
                              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-dark-bg/50 border border-dark-border/50 rounded-lg px-3 py-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area - Only show in chat view */}
            {viewMode === 'chat' && (
              <div className="px-3 pb-3 pt-2 border-t border-dark-border relative z-10">
                <div className="relative flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    className="flex-1 bg-dark-bg/50 text-white placeholder-gray-500 text-xs rounded-lg px-3 py-2 border border-dark-border/50 focus:border-primary/30 outline-none resize-none overflow-y-auto transition-all"
                    rows={1}
                    style={{ lineHeight: '24px', minHeight: '40px', maxHeight: '96px' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputMessage.trim()}
                    className="w-10 h-10 rounded-lg bg-primary hover:bg-primary-dark disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <Send size={16} className="text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default HelpChat
