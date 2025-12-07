import fs from 'fs';
import path from 'path';
import detect from 'detect-port';
import {
  DeploymentStrategy,
  DeploymentServiceType,
  PortAllocation,
  ProcessConfig,
  HealthCheckConfig,
  ValidationRequirement,
} from '../types';

/**
 * Vercel Deployment Strategy
 *
 * Handles single-process Vercel Dev deployment for frontend-only templates.
 * Port range: 3000-3099 (Vercel default)
 */
export class VercelStrategy implements DeploymentStrategy {
  readonly type: DeploymentServiceType = 'vercel';

  private readonly DEFAULT_VERCEL_PORT = 3000;
  private readonly MAX_VERCEL_PORT = 3099;

  private assignedPorts: Map<string, PortAllocation[]> = new Map();

  getPortRanges(): Array<{ min: number; max: number; portType: string }> {
    return [{ min: this.DEFAULT_VERCEL_PORT, max: this.MAX_VERCEL_PORT, portType: 'vercel' }];
  }

  async allocatePorts(projectId: string): Promise<PortAllocation[]> {
    // Check if already allocated
    const existing = this.assignedPorts.get(projectId);
    if (existing) {
      return existing;
    }

    // Find available port
    let port = this.DEFAULT_VERCEL_PORT;

    while (port <= this.MAX_VERCEL_PORT) {
      const availablePort = await detect(port);

      if (availablePort === port) {
        const allocations: PortAllocation[] = [{ primary: port, portType: 'vercel' }];
        this.assignedPorts.set(projectId, allocations);
        return allocations;
      }

      port = availablePort + 1;
    }

    throw new Error(
      `No available ports found in range ${this.DEFAULT_VERCEL_PORT}-${this.MAX_VERCEL_PORT}`
    );
  }

  releasePorts(projectId: string): void {
    this.assignedPorts.delete(projectId);
  }

  getProcessConfigs(projectPath: string, ports: PortAllocation[]): ProcessConfig[] {
    const vercelPort = ports.find((p) => p.portType === 'vercel')?.primary;
    if (!vercelPort) {
      throw new Error('Vercel port not found in allocations');
    }

    // For Vercel templates, run vite dev server directly from frontend/
    // This is simpler and more reliable than vercel dev for local development
    const frontendPath = path.join(projectPath, 'frontend');

    return [
      {
        id: 'vercel',
        command: 'npm',
        args: ['run', 'dev', '--', '--port', vercelPort.toString()],
        cwd: frontendPath,
        port: vercelPort,
        label: '',
        env: {
          FORCE_COLOR: '1',
          NODE_ENV: 'development',
          BROWSER: 'none',
        },
      },
    ];
  }

  getHealthCheckConfig(ports: PortAllocation[]): HealthCheckConfig {
    const vercelPort = ports.find((p) => p.portType === 'vercel')?.primary;
    if (!vercelPort) {
      throw new Error('Vercel port not found in allocations');
    }

    return {
      endpoints: [
        {
          url: `http://localhost:${vercelPort}`,
          label: 'vercel',
          required: true,
        },
      ],
    };
  }

  getValidationRequirements(): ValidationRequirement[] {
    return [
      {
        path: 'frontend',
        type: 'directory',
        required: true,
        description: 'Frontend application directory',
      },
      {
        path: 'frontend/package.json',
        type: 'file',
        required: true,
        description: 'Frontend package.json with React and Vite',
      },
      {
        path: 'frontend/vite.config.ts',
        type: 'file',
        required: false,
        description: 'Vite configuration (recommended)',
        alternatives: ['frontend/vite.config.js'],
      },
      {
        path: 'vercel.json',
        type: 'file',
        required: false,
        description: 'Vercel configuration file (optional)',
      },
    ];
  }

  updateProjectConfigs(projectPath: string, ports: PortAllocation[]): void {
    const vercelPort = ports.find((p) => p.portType === 'vercel')?.primary;
    if (!vercelPort) return;

    // Update vite.config if it exists in frontend/
    this.updateViteConfig(projectPath, vercelPort);
  }

  getPreviewPort(ports: PortAllocation[]): number {
    const vercelPort = ports.find((p) => p.portType === 'vercel')?.primary;
    if (!vercelPort) {
      throw new Error('Vercel port not found in allocations');
    }
    return vercelPort;
  }

  private updateViteConfig(projectPath: string, port: number): void {
    const viteConfigTsPath = path.join(projectPath, 'frontend/vite.config.ts');
    const viteConfigJsPath = path.join(projectPath, 'frontend/vite.config.js');
    const viteConfigPath = fs.existsSync(viteConfigTsPath) ? viteConfigTsPath : viteConfigJsPath;

    if (!fs.existsSync(viteConfigPath)) {
      return;
    }

    try {
      let content = fs.readFileSync(viteConfigPath, 'utf-8');
      const portPattern = /port:\s*(?:\d+|parseInt\([^)]+\))/g;
      content = content.replace(portPattern, `port: ${port}`);
      fs.writeFileSync(viteConfigPath, content);
    } catch (error) {
      console.error(`Failed to update ${path.basename(viteConfigPath)}:`, error);
    }
  }
}
