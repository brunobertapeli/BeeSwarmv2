import { useState, useEffect, useRef, forwardRef } from 'react'
import { ChevronDown, Send } from 'lucide-react'
import bgImage from '../assets/images/bg.jpg'

interface ResearchAgentProps {
  projectId?: string
}

// Helper to get display name from model ID
const getModelDisplayName = (modelId: string): string => {
  if (modelId.includes('sonnet')) return 'Sonnet 4.5'
  if (modelId.includes('opus')) return 'Opus 4.1'
  if (modelId.includes('haiku')) return 'Haiku 4.5'
  return modelId
}

const ResearchAgent = forwardRef<HTMLDivElement, ResearchAgentProps>(({ projectId }, ref) => {
  const [isVisible, setIsVisible] = useState(false)
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929')
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Slide up animation on mount
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  // Load available models on mount
  useEffect(() => {
    window.electronAPI?.claude.getModels().then((result) => {
      if (result.success && result.models) {
        setAvailableModels(result.models)
      }
    })
  }, [])

  // Close dropdown when clicking outside
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

  const handleSend = () => {
    if (message.trim()) {
      // TODO: Implement research agent send logic
      console.log('Research Agent:', message)
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Research Agent */}
      <div
        ref={ref}
        className={`fixed left-0 z-[100] transition-all duration-500 ease-out w-1/3 ${
          isVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-32 opacity-0'
        }`}
        style={{ bottom: '0px', height: '150px' }}
      >
        <div className="bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 shadow-2xl overflow-visible w-full h-full relative flex flex-col">
          {/* Top Row - Textarea with Send Icon Inside */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <div className="relative flex items-start">
              <div className="flex-1 border rounded-xl text-sm outline-none transition-all overflow-y-auto bg-dark-bg/50 border-dark-border/50 focus-within:border-primary/30 flex items-center">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask research agent..."
                    className="relative bg-transparent border-none outline-none resize-none text-white placeholder-gray-500 px-3.5 py-2.5 w-full"
                    rows={3}
                    style={{
                      lineHeight: '24px',
                      height: '77px',
                    }}
                  />
                </div>
              </div>
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                className={`absolute right-3 bottom-2.5 ${
                  message.trim()
                    ? 'text-primary hover:text-primary-dark cursor-pointer'
                    : 'text-gray-600 cursor-not-allowed'
                }`}
              >
                <Send size={18} />
              </button>
            </div>
          </div>

          {/* Bottom Row - Model Dropdown */}
          <div className="flex items-center gap-1.5 px-3 pb-2.5 flex-shrink-0">
            {/* Model Dropdown */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="bg-dark-bg/30 border border-dark-border/30 rounded-lg pl-2.5 pr-7 py-1.5 text-[11px] text-gray-300 outline-none hover:border-primary/30 transition-all cursor-pointer relative flex items-center gap-1.5"
              >
                <span>
                  {availableModels.length > 0
                    ? availableModels.find(m => m.value === selectedModel)?.displayName || getModelDisplayName(selectedModel)
                    : getModelDisplayName(selectedModel)}
                </span>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
              </button>

              {/* Dropdown Menu */}
              {showModelDropdown && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-[200]" onClick={() => setShowModelDropdown(false)} />

                  {/* Menu */}
                  <div className="absolute bottom-full left-0 mb-1 w-40 bg-dark-card border border-dark-border rounded-lg shadow-xl z-[201] overflow-hidden">
                    {/* Background Image */}
                    <div
                      className="absolute inset-0 opacity-10 pointer-events-none"
                      style={{
                        backgroundImage: `url(${bgImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />

                    <div className="p-1 relative z-10">
                      {(availableModels.length > 0 ? availableModels : [
                        { value: 'claude-sonnet-4-5-20250929', displayName: 'Sonnet 4.5' },
                        { value: 'claude-opus-4-1-20250805', displayName: 'Opus 4.1' },
                        { value: 'claude-haiku-4-5-20251001', displayName: 'Haiku 4.5' }
                      ]).map((model) => (
                        <button
                          key={model.value}
                          onClick={() => {
                            setSelectedModel(model.value)
                            setShowModelDropdown(false)
                          }}
                          className={`w-full px-2.5 py-1.5 rounded text-left text-[11px] transition-colors ${
                            selectedModel === model.value
                              ? 'bg-primary/20 text-primary'
                              : 'text-gray-300 hover:bg-dark-bg/50'
                          }`}
                        >
                          {model.displayName}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
})

ResearchAgent.displayName = 'ResearchAgent'

export default ResearchAgent
