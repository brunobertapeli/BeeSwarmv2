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
 * Railway Deployment Strategy
 *
 * Handles dual-process deployment with separate frontend and backend.
 * Port ranges: Frontend 5300-5399, Backend 3100-3199
 */
export class RailwayStrategy implements DeploymentStrategy {
  readonly type: DeploymentServiceType = 'railway';

  private readonly DEFAULT_FRONTEND_PORT = 5300;
  private readonly MAX_FRONTEND_PORT = 5399;
  private readonly DEFAULT_BACKEND_PORT = 3100;
  private readonly MAX_BACKEND_PORT = 3199;

  private assignedPorts: Map<string, PortAllocation[]> = new Map();

  getPortRanges(): Array<{ min: number; max: number; portType: string }> {
    return [
      { min: this.DEFAULT_FRONTEND_PORT, max: this.MAX_FRONTEND_PORT, portType: 'frontend' },
      { min: this.DEFAULT_BACKEND_PORT, max: this.MAX_BACKEND_PORT, portType: 'backend' },
    ];
  }

  async allocatePorts(projectId: string): Promise<PortAllocation[]> {
    // Check if already allocated
    const existing = this.assignedPorts.get(projectId);
    if (existing) {
      return existing;
    }

    // Find available frontend port
    const frontendPort = await this.findAvailablePortInRange(
      this.DEFAULT_FRONTEND_PORT,
      this.MAX_FRONTEND_PORT
    );

    // Find available backend port
    const backendPort = await this.findAvailablePortInRange(
      this.DEFAULT_BACKEND_PORT,
      this.MAX_BACKEND_PORT
    );

    const allocations: PortAllocation[] = [
      { primary: frontendPort, portType: 'frontend' },
      { primary: backendPort, portType: 'backend' },
    ];

    this.assignedPorts.set(projectId, allocations);
    return allocations;
  }

  releasePorts(projectId: string): void {
    this.assignedPorts.delete(projectId);
  }

  getProcessConfigs(projectPath: string, ports: PortAllocation[]): ProcessConfig[] {
    const frontendPort = ports.find((p) => p.portType === 'frontend')?.primary;
    const backendPort = ports.find((p) => p.portType === 'backend')?.primary;

    if (!frontendPort || !backendPort) {
      throw new Error('Frontend or backend port not found in allocations');
    }

    return [
      {
        id: 'backend',
        command: 'npm',
        args: ['run', 'dev'],
        cwd: path.join(projectPath, 'backend'),
        port: backendPort,
        label: '[backend]',
        env: {
          PORT: backendPort.toString(),
          FRONTEND_URL: `http://localhost:${frontendPort}`,
          NODE_ENV: 'development',
          FORCE_COLOR: '1',
        },
      },
      {
        id: 'frontend',
        command: 'npm',
        args: ['run', 'dev', '--', '--port', frontendPort.toString()],
        cwd: path.join(projectPath, 'frontend'),
        port: frontendPort,
        label: '[frontend]',
        env: {
          PORT: frontendPort.toString(),
          VITE_API_URL: `http://localhost:${backendPort}`,
          NODE_ENV: 'development',
          FORCE_COLOR: '1',
          BROWSER: 'none',
        },
      },
    ];
  }

  getHealthCheckConfig(ports: PortAllocation[]): HealthCheckConfig {
    const frontendPort = ports.find((p) => p.portType === 'frontend')?.primary;
    const backendPort = ports.find((p) => p.portType === 'backend')?.primary;

    if (!frontendPort || !backendPort) {
      throw new Error('Frontend or backend port not found in allocations');
    }

    return {
      endpoints: [
        {
          url: `http://localhost:${frontendPort}`,
          label: 'frontend',
          required: true,
        },
        {
          url: `http://localhost:${backendPort}`,
          label: 'backend',
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
        description: 'Frontend package.json',
      },
      {
        path: 'backend',
        type: 'directory',
        required: true,
        description: 'Backend application directory',
      },
      {
        path: 'backend/package.json',
        type: 'file',
        required: true,
        description: 'Backend package.json',
      },
      {
        path: 'frontend/vite.config.ts',
        type: 'file',
        required: false,
        description: 'Vite configuration (recommended)',
        alternatives: ['frontend/vite.config.js'],
      },
    ];
  }

  updateProjectConfigs(projectPath: string, ports: PortAllocation[]): void {
    const frontendPort = ports.find((p) => p.portType === 'frontend')?.primary;
    const backendPort = ports.find((p) => p.portType === 'backend')?.primary;

    if (!frontendPort || !backendPort) return;

    // Update frontend vite.config.ts
    this.updateViteConfig(projectPath, frontendPort);

    // Update frontend .env with VITE_API_URL (Vite reads from .env files, not process.env)
    this.updateFrontendEnv(projectPath, backendPort);

    // Update backend .env if exists, or create one (with PORT and FRONTEND_URL)
    this.updateBackendEnv(projectPath, backendPort, frontendPort);
  }

  getPreviewPort(ports: PortAllocation[]): number {
    const frontendPort = ports.find((p) => p.portType === 'frontend')?.primary;
    if (!frontendPort) {
      throw new Error('Frontend port not found in allocations');
    }
    return frontendPort;
  }

  private async findAvailablePortInRange(min: number, max: number): Promise<number> {
    let port = min;

    while (port <= max) {
      const availablePort = await detect(port);
      if (availablePort === port) {
        return port;
      }
      port = availablePort + 1;
    }

    throw new Error(`No available ports found in range ${min}-${max}`);
  }

  private updateViteConfig(projectPath: string, frontendPort: number): void {
    const viteConfigTsPath = path.join(projectPath, 'frontend/vite.config.ts');
    const viteConfigJsPath = path.join(projectPath, 'frontend/vite.config.js');
    const viteConfigPath = fs.existsSync(viteConfigTsPath) ? viteConfigTsPath : viteConfigJsPath;

    if (!fs.existsSync(viteConfigPath)) {
      return;
    }

    try {
      let content = fs.readFileSync(viteConfigPath, 'utf-8');
      const portPattern = /port:\s*(?:\d+|parseInt\([^)]+\))/g;
      content = content.replace(portPattern, `port: ${frontendPort}`);
      fs.writeFileSync(viteConfigPath, content);
    } catch (error) {
      console.error(`Failed to update ${path.basename(viteConfigPath)}:`, error);
    }
  }

  private updateFrontendEnv(projectPath: string, backendPort: number): void {
    const envPath = path.join(projectPath, 'frontend/.env');

    try {
      let content = '';
      const apiUrl = `http://localhost:${backendPort}`;

      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');

        // Update VITE_API_URL if it exists
        if (/^VITE_API_URL=/m.test(content)) {
          content = content.replace(/^VITE_API_URL=.*/m, `VITE_API_URL=${apiUrl}`);
        } else {
          content = `VITE_API_URL=${apiUrl}\n${content}`;
        }
      } else {
        content = `VITE_API_URL=${apiUrl}\n`;
      }

      fs.writeFileSync(envPath, content);
    } catch (error) {
      console.error('Failed to update frontend .env:', error);
    }
  }

  private updateBackendEnv(projectPath: string, backendPort: number, frontendPort: number): void {
    const envPath = path.join(projectPath, 'backend/.env');
    const frontendUrl = `http://localhost:${frontendPort}`;

    try {
      let content = '';

      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');

        // Update PORT if it exists
        if (/^PORT=/m.test(content)) {
          content = content.replace(/^PORT=.*/m, `PORT=${backendPort}`);
        } else {
          content = `PORT=${backendPort}\n${content}`;
        }

        // Update FRONTEND_URL if it exists
        if (/^FRONTEND_URL=/m.test(content)) {
          content = content.replace(/^FRONTEND_URL=.*/m, `FRONTEND_URL=${frontendUrl}`);
        } else {
          // Add after PORT line
          content = content.replace(/^(PORT=.*)$/m, `$1\nFRONTEND_URL=${frontendUrl}`);
        }
      } else {
        content = `PORT=${backendPort}\nFRONTEND_URL=${frontendUrl}\n`;
      }

      fs.writeFileSync(envPath, content);
    } catch (error) {
      console.error('Failed to update backend .env:', error);
    }
  }
}
