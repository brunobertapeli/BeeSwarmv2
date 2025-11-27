import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Github, X, Send, MoreVertical, Copy, ExternalLink, RotateCcw, Loader2, Lock, Globe, AlertTriangle, GitBranch, Clock, User } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import noiseBgImage from '../assets/images/noise_bg.png'

interface GitHubSheetProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
}

type SheetState = 'loading' | 'no-gh-cli' | 'setup' | 'main'

interface UnpushedCommit {
  hash: string
  shortHash: string
  message: string
  date: string
  author: string
}

interface GitCommit {
  hash: string
  shortHash: string
  message: string
  date: string
  author: string
}

interface RepoInfo {
  name: string
  owner: string
  isPrivate: boolean
  branch: string
  lastPushed: string | null
}

function GitHubSheet({ isOpen, onClose, projectId }: GitHubSheetProps) {
  const toast = useToast()
  const [sheetState, setSheetState] = useState<SheetState>('loading')
  const [unpushedCommits, setUnpushedCommits] = useState<UnpushedCommit[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [repoName, setRepoName] = useState('')
  const [repoDescription, setRepoDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [repoUrl, setRepoUrl] = useState<string | null>(null)
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [activeCommitMenu, setActiveCommitMenu] = useState<string | null>(null)
  const [showRevertModal, setShowRevertModal] = useState<GitCommit | null>(null)

  // Check state when sheet opens
  const checkState = useCallback(async () => {
    if (!projectId || !isOpen) return

    setSheetState('loading')

    try {
      // Check gh CLI first
      const ghResult = await window.electronAPI?.git.checkGhCli()
      if (!ghResult?.success) {
        setSheetState('no-gh-cli')
        return
      }

      if (!ghResult.installed || !ghResult.authenticated) {
        setSheetState('no-gh-cli')
        return
      }

      // Check for remote
      const remoteResult = await window.electronAPI?.git.getRemote(projectId)
      if (!remoteResult?.success) {
        setSheetState('setup')
        return
      }

      if (!remoteResult.hasRemote) {
        setSheetState('setup')
        return
      }

      setRepoUrl(remoteResult.repoUrl || null)

      // Extract owner and name from URL (https://github.com/owner/repo)
      const urlParts = remoteResult.repoUrl?.split('/') || []
      const repoNameFromUrl = urlParts.pop() || 'Repository'
      const ownerFromUrl = urlParts.pop() || ''

      // Get status for branch
      const statusResult = await window.electronAPI?.git.getStatus(projectId)
      const branch = statusResult?.branch || 'main'

      // Get log for last pushed
      const logResult = await window.electronAPI?.git.getLog(projectId)
      const lastPushed = logResult?.commits?.[0]?.date || null

      setRepoInfo({
        name: repoNameFromUrl,
        owner: ownerFromUrl,
        isPrivate: remoteResult.isPrivate ?? true,
        branch,
        lastPushed,
      })

      // Get unpushed commits and history
      const [unpushedResult, logResult2] = await Promise.all([
        window.electronAPI?.git.getUnpushed(projectId),
        window.electronAPI?.git.getLog(projectId),
      ])

      if (unpushedResult?.success && unpushedResult.commits) {
        setUnpushedCommits(unpushedResult.commits)
      }
      if (logResult2?.success && logResult2.commits) {
        setCommits(logResult2.commits)
      }

      setSheetState('main')
    } catch (error) {
      console.error('Error checking git state:', error)
      setSheetState('no-gh-cli')
    }
  }, [projectId, isOpen])

  const loadGitData = useCallback(async () => {
    if (!projectId) return

    try {
      const [unpushedResult, logResult] = await Promise.all([
        window.electronAPI?.git.getUnpushed(projectId),
        window.electronAPI?.git.getLog(projectId),
      ])

      if (unpushedResult?.success && unpushedResult.commits) {
        setUnpushedCommits(unpushedResult.commits)
      }

      if (logResult?.success && logResult.commits) {
        setCommits(logResult.commits)
        // Update last pushed in repoInfo
        if (logResult.commits.length > 0) {
          setRepoInfo(prev => prev ? { ...prev, lastPushed: logResult.commits![0].date } : null)
        }
      }
    } catch (error) {
      console.error('Error loading git data:', error)
    }
  }, [projectId])

  useEffect(() => {
    if (isOpen) {
      checkState()
    }
  }, [isOpen, checkState])

  // Poll for changes while open
  useEffect(() => {
    if (!isOpen || sheetState !== 'main' || !projectId) return

    const interval = setInterval(loadGitData, 5000)
    return () => clearInterval(interval)
  }, [isOpen, sheetState, projectId, loadGitData])

  const handleCreateRepo = async () => {
    if (!projectId || !repoName.trim()) return

    setIsLoading(true)
    try {
      const result = await window.electronAPI?.git.createRepo(
        projectId,
        repoName.trim(),
        repoDescription.trim(),
        isPrivate
      )

      if (result?.success) {
        toast.success('Repository created!', 'Your code has been pushed to GitHub')
        await checkState() // Refresh state
      } else {
        toast.error('Failed to create repo', result?.error || 'Unknown error')
      }
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Failed to create repository')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePush = async () => {
    if (!projectId || unpushedCommits.length === 0) return

    setIsLoading(true)
    try {
      const result = await window.electronAPI?.git.push(projectId)

      if (result?.success) {
        toast.success('Pushed!', `${unpushedCommits.length} commit${unpushedCommits.length > 1 ? 's' : ''} pushed to GitHub`)
        await loadGitData()
      } else {
        toast.error('Push failed', result?.error || 'Unknown error')
      }
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Failed to push')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopySha = (hash: string) => {
    navigator.clipboard.writeText(hash)
    toast.info('Copied', 'SHA copied to clipboard')
    setActiveCommitMenu(null)
  }

  const handleViewOnGitHub = (hash: string) => {
    if (repoUrl) {
      window.electronAPI?.shell.openExternal(`${repoUrl}/commit/${hash}`)
    }
    setActiveCommitMenu(null)
  }

  const handleRevert = async () => {
    if (!projectId || !showRevertModal) return

    setIsLoading(true)
    try {
      const result = await window.electronAPI?.git.revertAndPush(projectId, showRevertModal.hash)

      if (result?.success) {
        toast.success('Reverted!', `Reverted to "${showRevertModal.message}"`)
        setShowRevertModal(null)
        await loadGitData()
      } else {
        toast.error('Revert failed', result?.error || 'Unknown error')
      }
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Failed to revert')
    } finally {
      setIsLoading(false)
    }
  }

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{
            type: 'spring',
            damping: 25,
            stiffness: 300,
            mass: 0.8
          }}
          className="fixed bottom-0 left-0 right-0 h-[200px] z-[260] border-t border-white/10"
        >
          <div className="w-full h-full bg-dark-bg/80 backdrop-blur-xl relative">
            {/* Noise texture overlay - clipped to container */}
            <div className="absolute inset-0 overflow-hidden rounded-t-xl">
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  backgroundImage: `url(${noiseBgImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  mixBlendMode: 'soft-light',
                }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-all z-20 group"
            >
              <X size={18} className="text-gray-400 group-hover:text-white transition-colors" />
            </button>

            {/* Content based on state */}
            <div className="relative z-10 w-full h-full p-4">
              {/* Loading State */}
              {sheetState === 'loading' && (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 size={24} className="text-white animate-spin" />
                </div>
              )}

              {/* No GH CLI State */}
              {sheetState === 'no-gh-cli' && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="flex items-center gap-8">
                    {/* Icon */}
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <Github size={36} className="text-white" />
                    </div>

                    {/* Steps */}
                    <div className="flex gap-6">
                      {/* Step 1 */}
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-gray-400 font-medium flex-shrink-0 mt-0.5">1</div>
                        <div>
                          <p className="text-white text-sm font-medium mb-1">Install GitHub CLI</p>
                          <p className="text-gray-500 text-xs mb-2">A free tool to connect with GitHub</p>
                          <button
                            onClick={() => window.electronAPI?.shell.openExternal('https://cli.github.com')}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors flex items-center gap-1.5"
                          >
                            <ExternalLink size={12} />
                            Download GitHub CLI
                          </button>
                        </div>
                      </div>

                      {/* Connector */}
                      <div className="w-8 h-px bg-white/10 self-center" />

                      {/* Step 2 */}
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-gray-400 font-medium flex-shrink-0 mt-0.5">2</div>
                        <div>
                          <p className="text-white text-sm font-medium mb-1">Sign in to GitHub</p>
                          <p className="text-gray-500 text-xs mb-2">Run this command in your Terminal app</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText('gh auth login')
                              toast.success('Copied!', 'Now paste this in your Terminal app')
                            }}
                            className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/20 rounded-lg text-xs text-green-400 transition-colors flex items-center gap-1.5 font-mono"
                          >
                            <Copy size={12} />
                            gh auth login
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Setup State (No Remote) */}
              {sheetState === 'setup' && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="flex items-center gap-8">
                    {/* Left: Icon & Title */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <Github size={36} className="text-white" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-white font-medium text-sm">Create Repository</h3>
                        <p className="text-gray-500 text-xs">Push your project to GitHub</p>
                      </div>
                    </div>

                    {/* Connector */}
                    <div className="w-8 h-px bg-white/10" />

                    {/* Middle: Form Fields */}
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Repository Name</label>
                        <input
                          type="text"
                          value={repoName}
                          onChange={(e) => setRepoName(e.target.value)}
                          placeholder="my-awesome-project"
                          className="w-56 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Description (optional)</label>
                        <input
                          type="text"
                          value={repoDescription}
                          onChange={(e) => setRepoDescription(e.target.value)}
                          placeholder="A short description..."
                          className="w-56 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Connector */}
                    <div className="w-8 h-px bg-white/10" />

                    {/* Right: Visibility & Button */}
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">Visibility</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsPrivate(true)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                              isPrivate
                                ? 'bg-white/10 border border-white/20 text-white'
                                : 'bg-white/5 border border-white/5 text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            <Lock size={12} />
                            Private
                          </button>
                          <button
                            onClick={() => setIsPrivate(false)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                              !isPrivate
                                ? 'bg-white/10 border border-white/20 text-white'
                                : 'bg-white/5 border border-white/5 text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            <Globe size={12} />
                            Public
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleCreateRepo}
                        disabled={!repoName.trim() || isLoading}
                        className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                      >
                        {isLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <Send size={14} />
                            Create & Push
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Main State (Has Remote) */}
              {sheetState === 'main' && (
                <div className="w-full h-full flex gap-6">
                  {/* Left: Branding Column (Sidebar) */}
                  <div className="w-[260px] h-full flex flex-col justify-center rounded-2xl bg-white/5 border border-white/5 p-4 flex-shrink-0 relative overflow-hidden group">
                    {/* Background decoration */}
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-500" />

                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-1.5 bg-white/10 rounded-lg">
                          <Github size={18} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-gray-400 text-[10px] mb-0.5">
                            <User size={10} />
                            <span className="truncate">{repoInfo?.owner || 'owner'}</span>
                          </div>
                          <p className="text-white font-semibold text-sm truncate tracking-tight">
                            {repoInfo?.name || 'Repository'}
                          </p>
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div className="space-y-2">
                        {/* Branch */}
                        <div className="flex items-center justify-between text-[11px] group/item">
                          <div className="flex items-center gap-2 text-gray-500 group-hover/item:text-gray-400 transition-colors">
                            <GitBranch size={11} />
                            <span>Branch</span>
                          </div>
                          <span className="text-white font-medium font-mono bg-white/5 px-1.5 py-0.5 rounded text-[10px] border border-white/5">
                            {repoInfo?.branch || 'main'}
                          </span>
                        </div>

                        {/* Visibility */}
                        <div className="flex items-center justify-between text-[11px] group/item">
                          <div className="flex items-center gap-2 text-gray-500 group-hover/item:text-gray-400 transition-colors">
                            {repoInfo?.isPrivate ? <Lock size={11} /> : <Globe size={11} />}
                            <span>Visibility</span>
                          </div>
                          <span className="text-gray-300">{repoInfo?.isPrivate ? 'Private' : 'Public'}</span>
                        </div>

                        {/* Last pushed */}
                        <div className="flex items-center justify-between text-[11px] group/item">
                          <div className="flex items-center gap-2 text-gray-500 group-hover/item:text-gray-400 transition-colors">
                            <Clock size={11} />
                            <span>Pushed</span>
                          </div>
                          <span className="text-gray-300">
                            {repoInfo?.lastPushed ? getRelativeTime(repoInfo.lastPushed) : 'Never'}
                          </span>
                        </div>
                      </div>

                      {/* View on GitHub link */}
                      {repoUrl && (
                        <button
                          onClick={() => window.electronAPI?.shell.openExternal(repoUrl)}
                          className="mt-3 w-full py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-lg text-[10px] text-gray-400 hover:text-white transition-all flex items-center justify-center gap-2 group/btn"
                        >
                          <ExternalLink size={10} className="group-hover/btn:scale-110 transition-transform" />
                          View on GitHub
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Middle: Unpushed Commits */}
                  <div className="flex-1 flex flex-col min-w-0 py-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">UNPUSHED</span>
                        {unpushedCommits.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-green-500/20 rounded text-[10px] text-green-400 font-medium">{unpushedCommits.length}</span>
                        )}
                      </div>
                      {unpushedCommits.length > 0 && (
                        <button
                          onClick={handlePush}
                          disabled={isLoading}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white text-[10px] font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-green-900/20"
                        >
                          {isLoading ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <>
                              <Send size={10} />
                              Push to GitHub
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin pr-2">
                      {unpushedCommits.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 opacity-50">
                          <Github size={20} />
                          <p className="text-[10px]">All synced with GitHub</p>
                        </div>
                      ) : (
                        unpushedCommits.map((commit) => (
                          <div
                            key={commit.hash}
                            className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/10 group transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-gray-200 truncate font-medium">{commit.message}</p>
                              <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-gray-400">{commit.shortHash}</span>
                                <span>•</span>
                                <span>{getRelativeTime(commit.date)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px bg-white/10 my-2" />

                  {/* Right: History */}
                  <div className="flex-1 flex flex-col min-w-0 py-1">
                    <div className="flex items-center mb-2">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">HISTORY</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin pr-2">
                      {commits.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 opacity-50">
                          <Clock size={20} />
                          <p className="text-[10px]">No history available</p>
                        </div>
                      ) : (
                        commits.map((commit) => (
                          <div
                            key={commit.hash}
                            className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-white/5 group transition-colors border border-transparent hover:border-white/5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-gray-200 truncate font-medium mb-0.5">{commit.message}</p>
                              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-gray-400">{commit.shortHash}</span>
                                <span>•</span>
                                <span>{getRelativeTime(commit.date)}</span>
                              </div>
                            </div>
                            <div className="relative">
                              <button
                                onClick={() => setActiveCommitMenu(activeCommitMenu === commit.hash ? null : commit.hash)}
                                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white"
                              >
                                <MoreVertical size={12} />
                              </button>

                              {/* Context Menu */}
                              {activeCommitMenu === commit.hash && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setActiveCommitMenu(null)}
                                  />
                                  <div className="absolute right-0 bottom-full mb-1 bg-[#1C2128] border border-white/10 rounded-xl shadow-xl z-20 py-1 min-w-[160px] overflow-hidden">
                                    <button
                                      onClick={() => handleCopySha(commit.hash)}
                                      className="w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2 transition-colors"
                                    >
                                      <Copy size={12} />
                                      View on GitHub
                                    </button>
                                    {repoUrl && (
                                      <button
                                        onClick={() => handleViewOnGitHub(commit.hash)}
                                        className="w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2 transition-colors"
                                      >
                                        <ExternalLink size={12} />
                                        View on GitHub
                                      </button>
                                    )}
                                    <div className="h-px bg-white/5 my-1" />
                                    <button
                                      onClick={() => {
                                        setShowRevertModal(commit)
                                        setActiveCommitMenu(null)
                                      }}
                                      className="w-full px-4 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                                    >
                                      <RotateCcw size={12} />
                                      Revert to this
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Revert Confirmation Modal */}
            <AnimatePresence>
              {showRevertModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30"
                  onClick={() => setShowRevertModal(null)}
                >
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1C2128] border border-white/10 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl"
                  >
                    <div className="flex items-center gap-3 text-yellow-400 mb-4">
                      <div className="p-2 bg-yellow-500/10 rounded-lg">
                        <AlertTriangle size={20} />
                      </div>
                      <h3 className="font-semibold text-white">Revert to this commit?</h3>
                    </div>
                    <p className="text-sm text-gray-300 mb-2 italic border-l-2 border-white/10 pl-3 py-1">
                      "{showRevertModal.message}"
                    </p>
                    <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                      This will discard all changes made after this commit and force push the reverted state to GitHub. This action cannot be easily undone.
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setShowRevertModal(null)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-300 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRevert}
                        disabled={isLoading}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                      >
                        {isLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <RotateCcw size={14} />
                            Revert Changes
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default GitHubSheet
