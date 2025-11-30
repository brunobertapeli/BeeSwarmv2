import { DeploymentStrategy } from './types';
import { NetlifyStrategy } from './strategies/NetlifyStrategy';
import { RailwayStrategy } from './strategies/RailwayStrategy';

/**
 * Factory for creating deployment strategies
 *
 * Creates the appropriate strategy based on the deployServices array
 * from the project/template configuration.
 */
export class DeploymentStrategyFactory {
  private static netlifyStrategy: NetlifyStrategy | null = null;
  private static railwayStrategy: RailwayStrategy | null = null;

  /**
   * Create a deployment strategy based on the deploy services configuration
   * @param deployServices - Array of deployment service identifiers (e.g., ['netlify'] or ['railway'])
   * @returns The appropriate DeploymentStrategy instance
   */
  static create(deployServices: string[]): DeploymentStrategy {
    // Check for Railway first (takes precedence if both are specified)
    if (deployServices.includes('railway')) {
      if (!this.railwayStrategy) {
        this.railwayStrategy = new RailwayStrategy();
      }
      return this.railwayStrategy;
    }

    // Default to Netlify
    if (!this.netlifyStrategy) {
      this.netlifyStrategy = new NetlifyStrategy();
    }
    return this.netlifyStrategy;
  }

  /**
   * Get strategy by type
   * @param type - The deployment service type
   * @returns The appropriate DeploymentStrategy instance
   */
  static getByType(type: 'netlify' | 'railway'): DeploymentStrategy {
    return this.create([type]);
  }

  /**
   * Clear cached strategy instances (useful for testing)
   */
  static clearCache(): void {
    this.netlifyStrategy = null;
    this.railwayStrategy = null;
  }
}
