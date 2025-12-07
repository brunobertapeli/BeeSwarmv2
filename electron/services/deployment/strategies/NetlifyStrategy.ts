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
 * Netlify Deployment Strategy
 *
 * Handles single-process Netlify Dev deployment.
 * Port ranges: Netlify 8888-8999, Vite 5174-5274
 */
export class NetlifyStrategy implements DeploymentStrategy {
  readonly type: DeploymentServiceType = 'netlify';

  private readonly DEFAULT_NETLIFY_PORT = 8888;
  private readonly MAX_NETLIFY_PORT = 8999;
  private readonly DEFAULT_VITE_PORT = 5174;

  private assignedPorts: Map<string, PortAllocation[]> = new Map();

  getPortRanges(): Array<{ min: number; max: number; portType: string }> {
    return [
      { min: this.DEFAULT_NETLIFY_PORT, max: this.MAX_NETLIFY_PORT, portType: 'netlify' },
      { min: this.DEFAULT_VITE_PORT, max: this.DEFAULT_VITE_PORT + 100, portType: 'vite' },
    ];
  }

  async allocatePorts(projectId: string): Promise<PortAllocation[]> {
    // Check if already allocated
    const existing = this.assignedPorts.get(projectId);
    if (existing) {
      return existing;
    }

    // Find available port pair
    let port = this.DEFAULT_NETLIFY_PORT;

    while (port <= this.MAX_NETLIFY_PORT) {
      const availablePort = await detect(port);

      if (availablePort === port) {
        const vitePort = this.calculateVitePort(port);
        const availableVitePort = await detect(vitePort);

        if (availableVitePort === vitePort) {
          const allocations: PortAllocation[] = [
            { primary: port, portType: 'netlify' },
            { primary: vitePort, portType: 'vite' },
          ];
          this.assignedPorts.set(projectId, allocations);
          return allocations;
        } else {
          port++;
          continue;
        }
      }

      port = availablePort + 1;
    }

    throw new Error(
      `No available ports found in range ${this.DEFAULT_NETLIFY_PORT}-${this.MAX_NETLIFY_PORT}`
    );
  }

  releasePorts(projectId: string): void {
    this.assignedPorts.delete(projectId);
  }

  getProcessConfigs(projectPath: string, ports: PortAllocation[]): ProcessConfig[] {
    const netlifyPort = ports.find((p) => p.portType === 'netlify')?.primary;
    if (!netlifyPort) {
      throw new Error('Netlify port not found in allocations');
    }

    return [
      {
        id: 'netlify',
        command: 'npx',
        args: ['netlify', 'dev', '--port', netlifyPort.toString()],
        cwd: projectPath,
        port: netlifyPort,
        label: '', // No prefix for single-process
        env: {
          FORCE_COLOR: '1',
          NODE_ENV: 'development',
          BROWSER: 'none',
        },
      },
    ];
  }

  getHealthCheckConfig(ports: PortAllocation[]): HealthCheckConfig {
    const netlifyPort = ports.find((p) => p.portType === 'netlify')?.primary;
    if (!netlifyPort) {
      throw new Error('Netlify port not found in allocations');
    }

    return {
      endpoints: [
        {
          url: `http://localhost:${netlifyPort}`,
          label: 'netlify',
          required: true,
        },
      ],
    };
  }

  getValidationRequirements(): ValidationRequirement[] {
    return [
      {
        path: 'package.json',
        type: 'file',
        required: true,
        description: 'Root package.json with netlify-cli dependency',
      },
      {
        path: 'netlify.toml',
        type: 'file',
        required: true,
        description: 'Netlify configuration file',
      },
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
        path: 'netlify/functions',
        type: 'directory',
        required: false,
        description: 'Serverless functions directory',
      },
    ];
  }

  updateProjectConfigs(projectPath: string, ports: PortAllocation[]): void {
    const vitePort = ports.find((p) => p.portType === 'vite')?.primary;
    if (!vitePort) return;

    // Update vite.config.ts
    this.updateViteConfig(projectPath, vitePort);

    // Update netlify.toml
    this.updateNetlifyToml(projectPath, vitePort);
  }

  getPreviewPort(ports: PortAllocation[]): number {
    const netlifyPort = ports.find((p) => p.portType === 'netlify')?.primary;
    if (!netlifyPort) {
      throw new Error('Netlify port not found in allocations');
    }
    return netlifyPort;
  }

  private calculateVitePort(netlifyPort: number): number {
    return this.DEFAULT_VITE_PORT + (netlifyPort - this.DEFAULT_NETLIFY_PORT);
  }

  private updateViteConfig(projectPath: string, vitePort: number): void {
    const viteConfigTsPath = path.join(projectPath, 'frontend/vite.config.ts');
    const viteConfigJsPath = path.join(projectPath, 'frontend/vite.config.js');
    const viteConfigPath = fs.existsSync(viteConfigTsPath) ? viteConfigTsPath : viteConfigJsPath;

    if (!fs.existsSync(viteConfigPath)) {
      return;
    }

    try {
      let content = fs.readFileSync(viteConfigPath, 'utf-8');
      const portPattern = /port:\s*(?:\d+|parseInt\([^)]+\))/g;
      content = content.replace(portPattern, `port: ${vitePort}`);
      fs.writeFileSync(viteConfigPath, content);
    } catch (error) {
      console.error(`Failed to update ${path.basename(viteConfigPath)}:`, error);
    }
  }

  private updateNetlifyToml(projectPath: string, vitePort: number): void {
    const netlifyTomlPath = path.join(projectPath, 'netlify.toml');

    if (!fs.existsSync(netlifyTomlPath)) {
      return;
    }

    try {
      let content = fs.readFileSync(netlifyTomlPath, 'utf-8');
      const targetPortPattern = /targetPort\s*=\s*\d+/g;
      content = content.replace(targetPortPattern, `targetPort = ${vitePort}`);
      fs.writeFileSync(netlifyTomlPath, content);
    } catch (error) {
      console.error('Failed to update netlify.toml:', error);
    }
  }
}
