import detect from 'detect-port';

/**
 * PortService
 *
 * Manages port detection and assignment for dev servers.
 * Ensures no port conflicts between multiple projects.
 */
class PortService {
  private assignedPorts: Map<string, number> = new Map();
  private readonly DEFAULT_PORT = 8888; // Netlify dev default port
  private readonly MAX_PORT = 8999;

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
    let port = this.DEFAULT_PORT;

    while (port <= this.MAX_PORT) {
      const availablePort = await detect(port);

      // detect-port returns the requested port if available,
      // or the next available port if not
      if (availablePort === port) {
        // Port is available
        this.assignedPorts.set(projectId, port);
        return port;
      }

      // Try the next port
      port = availablePort + 1;
    }

    throw new Error(
      `No available ports found in range ${this.DEFAULT_PORT}-${this.MAX_PORT}`
    );
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
