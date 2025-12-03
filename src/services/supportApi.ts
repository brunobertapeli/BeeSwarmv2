const API_BASE_URL = 'https://codedeck-backend.onrender.com/api/v1'

interface SupportSession {
  _id?: string
  userId: string
  userName: string
  userEmail: string
  projectId?: string
  messages: Array<{
    userId: string
    userName: string
    userEmail: string
    type: 'user' | 'support'
    content: string
    timestamp: Date
    read: boolean
  }>
  status: 'active' | 'resolved'
}

interface SupportQueueEntry {
  _id?: string
  userId: string
  userName: string
  userEmail: string
  projectId?: string
  lastMessage: string
  status: 'waiting' | 'in-progress' | 'resolved'
  createdAt: Date
}

interface OfflineMessage {
  _id?: string
  userId: string
  userName: string
  userEmail: string
  projectId?: string
  subject: string
  message: string
  status: 'new' | 'read' | 'replied'
}

interface BugReport {
  _id?: string
  userId: string
  userName: string
  userEmail: string
  projectId?: string
  bugType: 'ui' | 'functionality' | 'performance' | 'crash' | 'templates' | 'other'
  title: string
  description: string
  stepsToReproduce?: string
  status: 'new' | 'investigating' | 'in-progress' | 'resolved' | 'wont-fix'
}

export const supportApi = {
  /**
   * Check if human support is available
   */
  async checkAvailability(): Promise<{ success: boolean; available: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/support/availability`)
      const data = await response.json()
      return data
    } catch (error: any) {
      console.error('Error checking support availability:', error)
      return { success: false, available: false, error: error.message }
    }
  },

  /**
   * Get user's active support session
   */
  async getSession(token: string): Promise<{ success: boolean; session: SupportSession | null; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/support/session`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      return data
    } catch (error: any) {
      console.error('Error getting support session:', error)
      return { success: false, session: null, error: error.message }
    }
  },

  /**
   * Add user to support queue
   */
  async addToQueue(
    token: string,
    data: { projectId?: string; lastMessage: string }
  ): Promise<{ success: boolean; queueEntry?: SupportQueueEntry; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/support/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      return result
    } catch (error: any) {
      console.error('Error adding to support queue:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Send offline message
   */
  async sendOfflineMessage(
    token: string,
    data: { projectId?: string; subject: string; message: string }
  ): Promise<{ success: boolean; offlineMessage?: OfflineMessage; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/support/offline-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      return result
    } catch (error: any) {
      console.error('Error sending offline message:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Submit bug report
   */
  async submitBugReport(
    token: string,
    data: {
      projectId?: string
      bugType: 'ui' | 'functionality' | 'performance' | 'crash' | 'templates' | 'other'
      title: string
      description: string
      stepsToReproduce?: string
    }
  ): Promise<{ success: boolean; bugReport?: BugReport; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/support/bug-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      return result
    } catch (error: any) {
      console.error('Error submitting bug report:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Chat with AI Assistant
   */
  async chat(
    token: string,
    message: string
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/support/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
      })
      const result = await response.json()
      return result
    } catch (error: any) {
      console.error('Error in AI chat:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Reset AI chat thread (start new conversation)
   */
  async resetChat(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/support/chat/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
      const result = await response.json()
      return result
    } catch (error: any) {
      console.error('Error resetting chat:', error)
      return { success: false, error: error.message }
    }
  }
}
