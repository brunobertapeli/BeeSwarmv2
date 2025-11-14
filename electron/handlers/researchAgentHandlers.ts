import { ipcMain, WebContents } from 'electron';
import { researchAgentService, ResearchAgentAttachment, ResearchAgentType } from '../services/ResearchAgentService';
import { databaseService } from '../services/DatabaseService';
import { validateProjectOwnership, UnauthorizedError } from '../middleware/authMiddleware';

let mainWindowContents: WebContents | null = null;

/**
 * Set the main window web contents for event emission
 */
export function setResearchAgentHandlersWindow(webContents: WebContents): void {
  mainWindowContents = webContents;
}

/**
 * Register Research Agent IPC handlers
 */
export function registerResearchAgentHandlers(): void {
  // Setup event forwarding
  setupResearchAgentEventForwarding();

  // Start a new research agent
  ipcMain.handle(
    'research-agent:start',
    async (
      _event,
      projectId: string,
      agentType: ResearchAgentType,
      task: string,
      model: string,
      attachments?: ResearchAgentAttachment[]
    ) => {
      try {
        // SECURITY: Validate user owns this project
        const project = validateProjectOwnership(projectId);

        // Start research agent
        const agentId = await researchAgentService.startAgent(
          projectId,
          project.path,
          agentType,
          task,
          model,
          attachments
        );

        return {
          success: true,
          agentId,
        };
      } catch (error) {
        console.error('❌ Error starting research agent:', error);

        if (error instanceof UnauthorizedError) {
          return {
            success: false,
            error: 'Unauthorized',
          };
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start research agent',
        };
      }
    }
  );

  // Stop a research agent
  ipcMain.handle('research-agent:stop', async (_event, agentId: string) => {
    try {
      const agent = researchAgentService.getAgent(agentId);
      if (!agent) {
        return {
          success: false,
          error: 'Agent not found',
        };
      }

      // SECURITY: Validate user owns this project
      validateProjectOwnership(agent.projectId);

      researchAgentService.stopAgent(agentId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error stopping research agent:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop research agent',
      };
    }
  });

  // Get all research agents for a project
  ipcMain.handle('research-agent:get-list', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId);

      // Load agents from database if not in memory
      researchAgentService.loadAgentsForProject(projectId);

      // Get agents from memory
      const agents = researchAgentService.getAgentsForProject(projectId);

      // Convert to serializable format
      const agentData = agents.map((agent) => ({
        id: agent.id,
        projectId: agent.projectId,
        agentType: agent.agentType,
        task: agent.task,
        model: agent.model,
        status: agent.status,
        currentActivity: agent.currentActivity,
        startTime: agent.startTime,
        endTime: agent.endTime,
        result: agent.result,
        briefDescription: agent.briefDescription,
        summary: agent.summary,
        actions: agent.actions,
        findings: agent.findings,
      }));

      return {
        success: true,
        agents: agentData,
      };
    } catch (error) {
      console.error('❌ Error getting research agents:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get research agents',
        agents: [],
      };
    }
  });

  // Get full history for an agent (for "See More" feature)
  ipcMain.handle('research-agent:get-full-history', async (_event, agentId: string) => {
    try {
      const agent = researchAgentService.getAgent(agentId);
      if (!agent) {
        return {
          success: false,
          error: 'Agent not found',
        };
      }

      // SECURITY: Validate user owns this project
      validateProjectOwnership(agent.projectId);

      let fullHistory = null;
      if (agent.fullHistory) {
        try {
          fullHistory = JSON.parse(agent.fullHistory);
        } catch (e) {
          console.warn('Failed to parse full history:', e);
        }
      }

      return {
        success: true,
        fullHistory,
      };
    } catch (error) {
      console.error('❌ Error getting agent full history:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get full history',
      };
    }
  });

  // Delete (archive) a research agent
  ipcMain.handle('research-agent:delete', async (_event, agentId: string) => {
    try {
      const dbAgent = databaseService.getResearchAgent(agentId);
      if (!dbAgent) {
        return {
          success: false,
          error: 'Agent not found',
        };
      }

      // SECURITY: Validate user owns this project
      validateProjectOwnership(dbAgent.projectId);

      // Just update status to 'stopped' instead of deleting
      databaseService.updateResearchAgentStatus(agentId, 'stopped');

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error deleting research agent:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete research agent',
      };
    }
  });
}

/**
 * Setup research agent event forwarding to renderer
 */
export function setupResearchAgentEventForwarding(): void {
  // Forward status updates
  researchAgentService.on('research-agent-status', ({ agentId, projectId, status, agent }) => {
    if (mainWindowContents) {
      mainWindowContents.send('research-agent:status-changed', agentId, projectId, status, agent);
    }
  });

  // Forward completion events
  researchAgentService.on('research-agent-complete', ({ agentId, projectId }) => {
    if (mainWindowContents) {
      mainWindowContents.send('research-agent:completed', agentId, projectId);
    }
  });

  // Forward real-time events (for future detailed logging)
  researchAgentService.on('research-agent-event', ({ agentId, projectId, type, message }) => {
    if (mainWindowContents) {
      mainWindowContents.send('research-agent:event', agentId, projectId, type, message);
    }
  });
}
