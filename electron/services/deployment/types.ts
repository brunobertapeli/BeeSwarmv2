/**
 * Deployment Strategy Types
 *
 * Core interfaces for the deployment strategy pattern.
 * Supports Netlify, Railway, and future deployment services.
 */

export type DeploymentServiceType = 'netlify' | 'railway';

/**
 * Port allocation for a deployment service
 */
export interface PortAllocation {
  primary: number;
  secondary?: number;
  portType: 'netlify' | 'vite' | 'frontend' | 'backend';
}

/**
 * Configuration for spawning a process
 */
export interface ProcessConfig {
  id: string; // 'netlify', 'frontend', 'backend'
  command: string; // 'npx' or 'npm'
  args: string[]; // ['netlify', 'dev'] or ['run', 'dev']
  cwd: string; // Working directory
  port: number; // Port this process listens on
  label: string; // '[frontend]', '[backend]', or ''
  env?: Record<string, string>; // Additional env vars
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  endpoints: Array<{
    url: string;
    label: string;
    required: boolean;
  }>;
}

/**
 * Template validation requirement
 */
export interface ValidationRequirement {
  path: string;
  type: 'file' | 'directory';
  required: boolean;
  description: string;
}

/**
 * Deployment strategy interface
 * Each deployment service (Netlify, Railway, etc.) implements this interface
 */
export interface DeploymentStrategy {
  readonly type: DeploymentServiceType;

  /**
   * Get port ranges used by this deployment type
   */
  getPortRanges(): Array<{ min: number; max: number; portType: string }>;

  /**
   * Allocate ports for a project
   */
  allocatePorts(projectId: string): Promise<PortAllocation[]>;

  /**
   * Release allocated ports
   */
  releasePorts(projectId: string): void;

  /**
   * Get process configurations to spawn
   */
  getProcessConfigs(projectPath: string, ports: PortAllocation[]): ProcessConfig[];

  /**
   * Get health check configuration
   */
  getHealthCheckConfig(ports: PortAllocation[]): HealthCheckConfig;

  /**
   * Get template validation requirements
   */
  getValidationRequirements(): ValidationRequirement[];

  /**
   * Update project configuration files with allocated ports
   */
  updateProjectConfigs(projectPath: string, ports: PortAllocation[]): void;

  /**
   * Get the primary port for preview (frontend URL)
   */
  getPreviewPort(ports: PortAllocation[]): number;
}
