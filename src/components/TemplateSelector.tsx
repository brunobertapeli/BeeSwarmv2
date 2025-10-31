import { useState } from 'react'
import { X, Sparkles, ExternalLink } from 'lucide-react'
import TechIcon from './TechIcon'
import { useAppStore } from '../store/appStore'

interface Template {
  id: string
  name: string
  description: string
  category: string
  techStack: string[]
  demoUrl: string
}

interface TemplateSelectorProps {
  isOpen: boolean
  onClose: () => void
  onCreateProject: (templateId: string, projectName: string) => void
}

// Mock templates organized by category
const templates: Template[] = [
  {
    id: 'webapp-1',
    name: 'React Node Lite',
    description: 'React + NodeJS Lite, with MaterialUI, Supabase for Authentication and MongoDB for the database.',
    category: 'E-commerce',
    techStack: ['react', 'node', 'supabase', 'mongodb'],
    demoUrl: 'https://demo.example.com/react-node-lite',
  },
  {
    id: 'webapp-2',
    name: 'React Node Lite + Stripe',
    description: 'React + NodeJS Lite with Stripe payment integration, MaterialUI, Supabase for Authentication and MongoDB.',
    category: 'E-commerce',
    techStack: ['react', 'node', 'supabase', 'mongodb', 'stripe'],
    demoUrl: 'https://demo.example.com/react-node-stripe',
  },
  {
    id: 'webapp-3',
    name: 'Marketplace Platform',
    description: 'Multi-vendor marketplace where sellers can list products and buyers can purchase from multiple vendors.',
    category: 'E-commerce',
    techStack: ['react', 'node', 'mongodb', 'stripe'],
    demoUrl: 'https://demo.example.com/marketplace',
  },
  {
    id: 'webapp-4',
    name: 'Product Catalog',
    description: 'Simple product catalog with shopping cart and checkout integration.',
    category: 'E-commerce',
    techStack: ['react', 'materialui', 'stripe'],
    demoUrl: 'https://demo.example.com/product-catalog',
  },
  {
    id: 'saas-1',
    name: 'SaaS Dashboard',
    description: 'Modern SaaS application dashboard with user management, subscription billing, and analytics.',
    category: 'SaaS',
    techStack: ['react', 'materialui', 'supabase', 'stripe'],
    demoUrl: 'https://demo.example.com/saas-dashboard',
  },
  {
    id: 'saas-2',
    name: 'Project Management',
    description: 'Collaborative project management tool with task boards, team chat, and file sharing capabilities.',
    category: 'SaaS',
    techStack: ['react', 'materialui', 'node', 'mongodb'],
    demoUrl: 'https://demo.example.com/project-mgmt',
  },
  {
    id: 'saas-3',
    name: 'CRM System',
    description: 'Customer relationship management system with contact management and sales pipeline tracking.',
    category: 'SaaS',
    techStack: ['react', 'node', 'mongodb'],
    demoUrl: 'https://demo.example.com/crm',
  },
  {
    id: 'landing-1',
    name: 'Startup Landing',
    description: 'High-converting landing page for startups with hero section, features showcase, and pricing tables.',
    category: 'Landing Pages',
    techStack: ['react', 'materialui'],
    demoUrl: 'https://demo.example.com/startup-landing',
  },
  {
    id: 'landing-2',
    name: 'Product Launch',
    description: 'Launch page for new products with countdown timer, email collection, and pre-order functionality.',
    category: 'Landing Pages',
    techStack: ['react', 'supabase'],
    demoUrl: 'https://demo.example.com/product-launch',
  },
  {
    id: 'landing-3',
    name: 'App Landing Page',
    description: 'Mobile app landing page with app store links, feature highlights, and testimonials.',
    category: 'Landing Pages',
    techStack: ['react', 'materialui'],
    demoUrl: 'https://demo.example.com/app-landing',
  },
  {
    id: 'blog-1',
    name: 'Personal Blog',
    description: 'Clean and minimalist blog platform with markdown support, categories, tags, and comment system.',
    category: 'Blog',
    techStack: ['react', 'node', 'mongodb'],
    demoUrl: 'https://demo.example.com/personal-blog',
  },
  {
    id: 'blog-2',
    name: 'Tech Blog',
    description: 'Technical blog with code highlighting, search functionality, and RSS feed support.',
    category: 'Blog',
    techStack: ['react', 'node', 'mongodb'],
    demoUrl: 'https://demo.example.com/tech-blog',
  },
  {
    id: 'portfolio-1',
    name: 'Developer Portfolio',
    description: 'Showcase your projects and skills with this elegant portfolio template featuring project galleries.',
    category: 'Portfolio',
    techStack: ['react', 'node'],
    demoUrl: 'https://demo.example.com/dev-portfolio',
  },
  {
    id: 'portfolio-2',
    name: 'Designer Portfolio',
    description: 'Creative portfolio for designers with image galleries, case studies, and contact integration.',
    category: 'Portfolio',
    techStack: ['react', 'materialui'],
    demoUrl: 'https://demo.example.com/designer-portfolio',
  },
]

const categories = ['E-commerce', 'SaaS', 'Landing Pages', 'Blog', 'Portfolio']

// Tech configuration with required API keys
export interface TechApiKey {
  name: string
  label: string
  placeholder: string
  description?: string
}

export interface TechConfig {
  name: string
  displayName: string
  icon: string
  apiKeys: TechApiKey[]
}

const TECH_CONFIGS: Record<string, TechConfig> = {
  stripe: {
    name: 'stripe',
    displayName: 'Stripe',
    icon: '/src/assets/tech-icons/stripe.svg',
    apiKeys: [
      {
        name: 'STRIPE_PUBLISHABLE_KEY',
        label: 'Publishable Key',
        placeholder: 'pk_test_...',
        description: 'Used for client-side operations',
      },
      {
        name: 'STRIPE_SECRET_KEY',
        label: 'Secret Key',
        placeholder: 'sk_test_...',
        description: 'Used for server-side operations',
      },
      {
        name: 'STRIPE_WEBHOOK_SECRET',
        label: 'Webhook Signing Secret',
        placeholder: 'whsec_...',
        description: 'Used to verify webhook events',
      },
    ],
  },
  mongodb: {
    name: 'mongodb',
    displayName: 'MongoDB',
    icon: '/src/assets/tech-icons/mongodb.svg',
    apiKeys: [
      {
        name: 'MONGODB_URI',
        label: 'Connection String',
        placeholder: 'mongodb+srv://username:password@cluster.mongodb.net/database',
        description: 'Your MongoDB connection string',
      },
    ],
  },
  supabase: {
    name: 'supabase',
    displayName: 'Supabase',
    icon: '/src/assets/tech-icons/supabase.svg',
    apiKeys: [
      {
        name: 'SUPABASE_URL',
        label: 'Project URL',
        placeholder: 'https://xxxxx.supabase.co',
        description: 'Your Supabase project URL',
      },
      {
        name: 'SUPABASE_ANON_KEY',
        label: 'Anon Key',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'Public anonymous key for client-side',
      },
      {
        name: 'SUPABASE_SERVICE_ROLE_KEY',
        label: 'Service Role Key',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'Secret key for server-side admin operations',
      },
    ],
  },
}

// Get required tech configs based on tech stack
const getRequiredTechConfigs = (techStack: string[]): TechConfig[] => {
  const configs: TechConfig[] = []
  techStack.forEach((tech) => {
    if (TECH_CONFIGS[tech]) {
      configs.push(TECH_CONFIGS[tech])
    }
  })
  return configs
}

// Mini tech icon component for the list (with hover effects)
function MiniTechIcon({ tech }: { tech: string }) {
  const [isHovered, setIsHovered] = useState(false)
  const config = {
    react: { color: '#61DAFB', displayName: 'React' },
    node: { color: '#339933', displayName: 'Node.js' },
    mongodb: { color: '#47A248', displayName: 'MongoDB' },
    stripe: { color: '#635BFF', displayName: 'Stripe' },
    supabase: { color: '#3ECF8E', displayName: 'Supabase' },
    materialui: { color: '#007FFF', displayName: 'Material UI' },
  }[tech.toLowerCase()] || { color: '#888888', displayName: tech }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-4 h-4">
        <img
          src={`/src/assets/tech-icons/${tech}.svg`}
          alt={tech}
          className="w-full h-full transition-all duration-200"
          style={{
            filter: isHovered ? 'none' : 'grayscale(100%) brightness(0.5) opacity(0.7)',
          }}
        />
      </div>
      {isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 pointer-events-none z-10">
          <div className="px-1.5 py-0.5 bg-dark-bg/95 backdrop-blur-sm border border-dark-border rounded shadow-xl whitespace-nowrap">
            <span className="text-[9px] text-white font-medium">{config.displayName}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateSelector({ isOpen, onClose, onCreateProject }: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(templates[0])
  const [projectName, setProjectName] = useState('')
  const { setNewProjectData, setProjectSetupMode, setShowProjectSettings } = useAppStore()

  // Convert project name to project ID (lowercase, spaces to dashes)
  const projectId = projectName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const handleCreate = () => {
    if (selectedTemplate && projectName.trim()) {
      // Get required tech configs for this template
      const requiredTechConfigs = getRequiredTechConfigs(selectedTemplate.techStack)

      // Store new project data and trigger setup mode
      setNewProjectData({
        templateId: selectedTemplate.id,
        requiredTechConfigs,
      })

      // Create the project
      onCreateProject(selectedTemplate.id, projectName.trim())

      // If the template requires API keys, trigger setup mode
      if (requiredTechConfigs.length > 0) {
        setProjectSetupMode(true)
        setShowProjectSettings(true)
      }

      setProjectName('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[800px] max-h-[70vh] bg-dark-card border border-dark-border rounded-xl shadow-2xl animate-scaleIn overflow-hidden flex flex-col">
        {/* Header - Spans Both Columns */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border/50">
          <div>
            <h2 className="text-sm font-semibold text-white">Create New Project</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">{templates.length} templates available</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-dark-bg/70 rounded-md transition-all"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Content - Two Columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column - Templates List */}
          <div className="w-[320px] border-r border-dark-border flex flex-col">
            {/* Templates List by Category with Scrollbar */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
              <div className="space-y-3">
                {categories.map((category) => {
                  const categoryTemplates = templates.filter((t) => t.category === category)
                  return (
                    <div key={category}>
                      <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 px-1">
                        {category}
                      </h3>
                      <div className="space-y-1">
                        {categoryTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => setSelectedTemplate(template)}
                            className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${
                              selectedTemplate?.id === template.id
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-transparent hover:border-dark-border hover:bg-dark-bg/30'
                            }`}
                          >
                            <h4 className="text-[12px] font-medium text-white mb-1.5">{template.name}</h4>
                            <div className="flex items-center gap-1.5">
                              {template.techStack.slice(0, 5).map((tech) => (
                                <MiniTechIcon key={tech} tech={tech} />
                              ))}
                              {template.techStack.length > 5 && (
                                <span className="text-[9px] text-gray-600">+{template.techStack.length - 5}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Template Details */}
          <div className="flex-1 flex flex-col">
            {/* Template Details Content */}
            {selectedTemplate && (
              <div className="flex-1 overflow-y-auto p-5">
                {/* Template Title */}
                <div className="mb-4">
                  <h1 className="text-lg font-bold text-white mb-2">{selectedTemplate.name}</h1>
                  <p className="text-[13px] text-gray-400 leading-relaxed">{selectedTemplate.description}</p>
                </div>

                {/* Demo Link Button */}
                <div className="mb-5">
                  <a
                    href={selectedTemplate.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-bg/70 hover:bg-dark-bg border border-dark-border hover:border-primary/50 rounded-lg text-[11px] text-gray-300 hover:text-white font-medium transition-all group"
                  >
                    <ExternalLink size={11} className="group-hover:text-primary transition-colors" />
                    View Live Demo
                  </a>
                </div>

                {/* Tech Stack */}
                <div className="mb-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Tech Stack
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.techStack.map((tech) => (
                      <TechIcon
                        key={tech}
                        name={tech}
                        label={tech.charAt(0).toUpperCase() + tech.slice(1)}
                      />
                    ))}
                  </div>
                </div>

                {/* Project Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Awesome Project"
                    className="w-full bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate()
                    }}
                  />
                  {projectId && (
                    <p className="text-[10px] text-gray-500 mt-1.5">
                      Project ID: <span className="text-gray-400 font-mono">{projectId}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Footer - Create Button */}
            <div className="px-5 py-3 border-t border-dark-border/50 bg-dark-bg/20">
              <button
                onClick={handleCreate}
                disabled={!projectName.trim()}
                className={`w-full px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  projectName.trim()
                    ? 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20 hover:shadow-primary/40'
                    : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Sparkles size={14} />
                Create Project
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TemplateSelector
