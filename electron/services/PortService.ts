import detect from 'detect-port';

/**
 * PortService
 *
 * Manages port detection and assignment for dev servers.
 * Ensures no port conflicts between multiple projects.
 */
class PortService {
  private assignedPorts: Map<string, number> = new Map();
  private readonly DEFAULT_NETLIFY_PORT = 8888;
  private readonly MAX_NETLIFY_PORT = 8999;
  private readonly DEFAULT_VITE_PORT = 5174;

  /**
   * Calculate Vite port based on Netlify port
   * Keeps ports synchronized: Netlify 8888 → Vite 5174, Netlify 8889 → Vite 5175, etc.
   */
  private calculateVitePort(netlifyPort: number): number {
    return this.DEFAULT_VITE_PORT + (netlifyPort - this.DEFAULT_NETLIFY_PORT);
  }

  /**
   * Find an available port starting from the default port (8888)
   * @param projectId - Unique project identifier
   * @returns Available port number
   */
  async findAvailablePort(projectId: string): Promise<number> {
    // Check if this project already has an assigned port
    const existingPort = this.assignedPorts.get(projectId);
    if (existingPort) {
      // Verify the port is still available
      const isAvailable = await this.isPortAvailable(existingPort);
      if (isAvailable) {
        return existingPort;
      }
      // Port is no longer available, remove it
      this.assignedPorts.delete(projectId);
    }

    // Find next available port
    let port = this.DEFAULT_NETLIFY_PORT;

    while (port <= this.MAX_NETLIFY_PORT) {
      const availablePort = await detect(port);

      // detect-port returns the requested port if available,
      // or the next available port if not
      if (availablePort === port) {
        // Check if corresponding Vite port is also available
        const vitePort = this.calculateVitePort(port);
        const availableVitePort = await detect(vitePort);

        if (availableVitePort === vitePort) {
          // Both ports are available
          this.assignedPorts.set(projectId, port);
          console.log(`✅ Allocated ports for ${projectId}: Netlify ${port}, Vite ${vitePort}`);
          return port;
        } else {
          console.log(`⚠️ Port ${port} available but Vite port ${vitePort} in use, trying next...`);
          port++;
          continue;
        }
      }

      // Try the next port
      port = availablePort + 1;
    }

    throw new Error(
      `No available ports found in range ${this.DEFAULT_NETLIFY_PORT}-${this.MAX_NETLIFY_PORT}`
    );
  }

  /**
   * Get the Vite port for a given Netlify port
   * @param netlifyPort - Netlify dev port
   * @returns Corresponding Vite port
   */
  getVitePort(netlifyPort: number): number {
    return this.calculateVitePort(netlifyPort);
  }

  /**
   * Check if a specific port is available
   * @param port - Port number to check
   * @returns True if port is available
   */
  async isPortAvailable(port: number): Promise<boolean> {
    const availablePort = await detect(port);
    return availablePort === port;
  }

  /**
   * Get the assigned port for a project
   * @param projectId - Unique project identifier
   * @returns Assigned port or undefined
   */
  getAssignedPort(projectId: string): number | undefined {
    return this.assignedPorts.get(projectId);
  }

  /**
   * Release a port when a project is closed
   * @param projectId - Unique project identifier
   */
  releasePort(projectId: string): void {
    this.assignedPorts.delete(projectId);
  }

  /**
   * Release all ports (on app quit)
   */
  releaseAllPorts(): void {
    this.assignedPorts.clear();
  }

  /**
   * Get all assigned ports (for debugging)
   */
  getAllAssignedPorts(): Map<string, number> {
    return new Map(this.assignedPorts);
  }
}

// Export singleton instance
export const portService = new PortService();
