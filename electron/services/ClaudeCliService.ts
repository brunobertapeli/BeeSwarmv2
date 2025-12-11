/**
 * ClaudeCliService
 *
 * Service to check Claude Code CLI installation and authentication status.
 * Uses multiple fallback methods for reliable cross-platform detection.
 */

import { spawn, execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { bundledBinaries } from './BundledBinaries.js'

export interface ClaudeCliStatus {
  installed: boolean
  authenticated: boolean
  email?: string
  error?: string
}

class ClaudeCliService {
  /**
   * Check if Claude CLI is installed
   */
  isInstalled(): boolean {
    return bundledBinaries.isClaudeAvailable()
  }

  /**
   * Get the effective Claude CLI path
   */
  getClaudePath(): string {
    return bundledBinaries.getEffectiveClaudePath()
  }

  /**
   * Check if Claude CLI is authenticated using multiple fallback methods:
   * 1. Fast config file check (~/.claude.json)
   * 2. CLI version check to verify installation
   * 3. SDK API call to verify actual authentication works
   */
  async checkAuthentication(): Promise<ClaudeCliStatus> {
    console.log('[ClaudeCliService] Checking authentication...')

    // Step 1: Check if CLI is installed
    if (!this.isInstalled()) {
      console.log('[ClaudeCliService] Claude CLI not installed via bundledBinaries')

      // Fallback: Try running claude --version directly
      const versionCheck = await this.checkCliVersion()
      if (!versionCheck.installed) {
        return { installed: false, authenticated: false }
      }
    }

    console.log('[ClaudeCliService] Claude CLI is installed')

    // Step 2: Always verify with SDK - this is the most reliable method
    // Config files can exist without valid auth (e.g., after installing but before login)
    console.log('[ClaudeCliService] Verifying authentication with SDK...')
    const sdkCheck = await this.verifyWithSdk()

    if (sdkCheck.verified) {
      console.log('[ClaudeCliService] SDK verified authentication')
      return {
        installed: true,
        authenticated: true,
        email: sdkCheck.email
      }
    }

    // SDK check failed - check if it's an auth error vs network/other error
    const errorMsg = (sdkCheck.error || '').toLowerCase()
    const isAuthError = errorMsg.includes('auth') ||
                        errorMsg.includes('login') ||
                        errorMsg.includes('unauthorized') ||
                        errorMsg.includes('api key') ||
                        errorMsg.includes('not authenticated')

    if (isAuthError) {
      // Definite auth failure - user is not logged in
      console.log('[ClaudeCliService] SDK indicates not authenticated:', sdkCheck.error)
      return {
        installed: true,
        authenticated: false,
        error: 'Not logged in to Claude'
      }
    }

    // SDK failed for non-auth reason (network, timeout, etc.)
    // Check config files as fallback
    console.log('[ClaudeCliService] SDK failed (non-auth error), checking config as fallback:', sdkCheck.error)
    const configCheck = await this.checkConfigFiles()

    if (configCheck.authenticated) {
      // Config suggests auth, and SDK didn't explicitly say "not authenticated"
      // Trust the config (user might be offline but previously logged in)
      console.log('[ClaudeCliService] Config indicates authenticated, trusting for offline case')
      return {
        installed: true,
        authenticated: true,
        email: configCheck.email
      }
    }

    // Neither SDK nor config indicate authentication
    return {
      installed: true,
      authenticated: false,
      error: sdkCheck.error || 'Not logged in to Claude'
    }
  }

  /**
   * Check CLI installation by running --version
   */
  private async checkCliVersion(): Promise<{ installed: boolean; version?: string }> {
    try {
      const claudePath = this.getClaudePath()
      console.log(`[ClaudeCliService] Running ${claudePath} --version`)

      const versionOutput = execSync(`"${claudePath}" --version`, {
        timeout: 10000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      })

      console.log('[ClaudeCliService] Version:', versionOutput.trim())
      return { installed: true, version: versionOutput.trim() }
    } catch (error: any) {
      console.log('[ClaudeCliService] Version check failed:', error.message)
      return { installed: false }
    }
  }

  /**
   * Fast check using config files (works on macOS, Linux, Windows)
   * Config locations from official docs: https://code.claude.com/docs/en/setup
   *
   * NOTE: This is now just a hint - we always verify with SDK for reliable auth check
   */
  private async checkConfigFiles(): Promise<{ authenticated: boolean; email?: string }> {
    const homeDir = os.homedir()

    // Paths to check (cross-platform) - based on official Claude Code docs
    const configPaths: string[] = []

    if (process.platform === 'win32') {
      // Windows: %USERPROFILE%\.claude.json and %USERPROFILE%\.claude\
      configPaths.push(
        path.join(homeDir, '.claude.json'),
        path.join(homeDir, '.claude', 'config.json'),
        path.join(homeDir, '.claude', 'settings.json'),
      )
    } else {
      // macOS / Linux: ~/.claude.json and ~/.claude/
      configPaths.push(
        path.join(homeDir, '.claude.json'),
        path.join(homeDir, '.claude', 'config.json'),
        path.join(homeDir, '.claude', 'settings.json'),
        // XDG config (Linux)
        path.join(homeDir, '.config', 'claude', 'config.json'),
      )
    }

    for (const configPath of configPaths) {
      console.log(`[ClaudeCliService] Checking config: ${configPath}`)
      try {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf-8')
          const config = JSON.parse(content)
          console.log(`[ClaudeCliService] Config contents:`, JSON.stringify(config, null, 2))

          // Only trust strong auth indicators (actual tokens/keys)
          // hasCompletedOnboarding alone is NOT enough - user may have onboarded but not logged in
          if (
            config.oauthAccessToken ||
            config.apiKey ||
            config.primaryApiKey
          ) {
            console.log('[ClaudeCliService] Found strong auth indicator (token/key) in config')
            return {
              authenticated: true,
              email: config.email || config.userID || config.primaryEmail
            }
          }

          // hasCompletedOnboarding + userID might indicate auth, but we should verify
          if (config.hasCompletedOnboarding === true && config.userID) {
            console.log('[ClaudeCliService] Found hasCompletedOnboarding + userID, needs SDK verification')
            return {
              authenticated: true,
              email: config.email || config.userID || config.primaryEmail
            }
          }
        }
      } catch (e) {
        // Continue to next path
      }
    }

    return { authenticated: false }
  }

  /**
   * Verify authentication by making an actual SDK call
   * This is the most reliable method but slower
   */
  private async verifyWithSdk(): Promise<{ verified: boolean; email?: string; error?: string }> {
    try {
      console.log('[ClaudeCliService] Verifying with SDK...')

      // Get the Claude executable path
      const claudePath = this.getClaudePath()
      console.log('[ClaudeCliService] Using Claude path:', claudePath)

      // Dynamic import to avoid issues if SDK not available
      const { query } = await import('@anthropic-ai/claude-agent-sdk')

      // Create a minimal query to test authentication
      const q = query({
        prompt: 'Say "ok"',
        options: {
          maxTurns: 1,
          allowedTools: [], // No tools needed
          pathToClaudeCodeExecutable: claudePath,
        }
      })

      // Try to get account info - this requires valid auth
      const accountInfo = await Promise.race([
        q.accountInfo(),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('SDK timeout')), 15000)
        )
      ])

      if (accountInfo?.email) {
        console.log('[ClaudeCliService] SDK verified, email:', accountInfo.email)
        return { verified: true, email: accountInfo.email }
      }

      // If accountInfo succeeds but no email, still consider authenticated
      if (accountInfo) {
        console.log('[ClaudeCliService] SDK verified (no email)')
        return { verified: true }
      }

      return { verified: false, error: 'No account info returned' }
    } catch (error: any) {
      console.log('[ClaudeCliService] SDK verification failed:', error.message)

      // Check if error indicates auth problem vs other issue
      const msg = error.message?.toLowerCase() || ''
      if (msg.includes('auth') || msg.includes('login') || msg.includes('unauthorized') || msg.includes('api key')) {
        return { verified: false, error: 'Not authenticated' }
      }

      // Network or other error - don't assume not authenticated
      return { verified: false, error: error.message }
    }
  }

  /**
   * Launch Claude login flow (opens browser for authentication)
   * Returns a promise that resolves when the login command completes.
   */
  async launchLogin(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const claudePath = this.getClaudePath()

      const loginProcess = spawn(claudePath, ['login'], {
        shell: true,
        stdio: 'inherit' // Allows interactive browser flow
      })

      let timeoutId: NodeJS.Timeout | null = null

      loginProcess.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId)

        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({
            success: false,
            error: `Login process exited with code ${code}`
          })
        }
      })

      loginProcess.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId)
        resolve({ success: false, error: error.message })
      })

      // Set a 5-minute timeout for the login process
      timeoutId = setTimeout(() => {
        try {
          loginProcess.kill()
        } catch {}
        resolve({ success: false, error: 'Login timeout - please try again' })
      }, 5 * 60 * 1000)
    })
  }
}

export const claudeCliService = new ClaudeCliService()
