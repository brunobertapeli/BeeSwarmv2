import fs from 'fs';
import path from 'path';
import { DeploymentStrategyFactory, ValidationRequirement } from './deployment';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * TemplateValidator Service
 *
 * Validates that cloned templates follow the required structure
 * based on their deployment service type (Netlify, Railway, etc.)
 */
class TemplateValidator {
  /**
   * Validate template structure
   * @param projectPath - Absolute path to project root
   * @param deployServices - Array of deployment services (defaults to ['netlify'])
   * @returns Validation result with errors and warnings
   */
  validate(projectPath: string, deployServices: string[] = ['netlify']): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if project directory exists
    if (!fs.existsSync(projectPath)) {
      return {
        valid: false,
        errors: [`Project directory does not exist: ${projectPath}`],
        warnings: [],
      };
    }

    // Get validation requirements from strategy
    const strategy = DeploymentStrategyFactory.create(deployServices);
    const requirements = strategy.getValidationRequirements();

    // Validate each requirement
    for (const req of requirements) {
      const fullPath = path.join(projectPath, req.path);
      const exists = fs.existsSync(fullPath);

      if (!exists) {
        if (req.required) {
          errors.push(`Missing required ${req.type}: ${req.path} - ${req.description}`);
        } else {
          warnings.push(`Missing optional ${req.type}: ${req.path} - ${req.description}`);
        }
        continue;
      }

      // Verify type matches
      const stats = fs.statSync(fullPath);
      const isCorrectType =
        (req.type === 'file' && stats.isFile()) ||
        (req.type === 'directory' && stats.isDirectory());

      if (!isCorrectType) {
        errors.push(`Invalid type for ${req.path}: expected ${req.type}`);
      }
    }

    // Additional validation based on deployment type
    if (deployServices.includes('netlify')) {
      this.validateNetlifySpecifics(projectPath, errors, warnings);
    }

    if (deployServices.includes('railway')) {
      this.validateRailwaySpecifics(projectPath, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Netlify-specific validation
   */
  private validateNetlifySpecifics(
    projectPath: string,
    errors: string[],
    warnings: string[]
  ): void {
    // Check for netlify-cli in root package.json
    const rootPackageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(rootPackageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));
        const hasNetlifyCli =
          packageJson.devDependencies?.['netlify-cli'] ||
          packageJson.dependencies?.['netlify-cli'];

        if (!hasNetlifyCli) {
          warnings.push(
            'Root package.json missing netlify-cli in dependencies. ' +
              'Dev server may not work without global installation.'
          );
        }
      } catch (error) {
        errors.push(`Failed to parse root package.json: ${error}`);
      }
    }

    // Check frontend port configuration
    const viteConfigPath = path.join(projectPath, 'frontend/vite.config.ts');
    const viteConfigJsPath = path.join(projectPath, 'frontend/vite.config.js');

    if (fs.existsSync(viteConfigJsPath)) {
      warnings.push(
        'Found vite.config.js - should use vite.config.ts instead to avoid port conflicts'
      );
    }

    if (fs.existsSync(viteConfigPath)) {
      try {
        const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');

        // Check for port 5174 configuration
        if (!viteConfig.includes('5174')) {
          warnings.push(
            'frontend/vite.config.ts should specify port 5174 to avoid conflict with CodeDeck (port 5173)'
          );
        }
      } catch (error) {
        warnings.push(`Could not read vite.config.ts: ${error}`);
      }
    }
  }

  /**
   * Railway-specific validation
   */
  private validateRailwaySpecifics(
    projectPath: string,
    errors: string[],
    warnings: string[]
  ): void {
    // Check frontend package.json has dev script
    const frontendPackagePath = path.join(projectPath, 'frontend/package.json');
    if (fs.existsSync(frontendPackagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(frontendPackagePath, 'utf-8'));
        if (!packageJson.scripts?.dev) {
          errors.push('frontend/package.json missing "dev" script');
        }
      } catch (error) {
        errors.push(`Failed to parse frontend/package.json: ${error}`);
      }
    }

    // Check backend package.json has dev script
    const backendPackagePath = path.join(projectPath, 'backend/package.json');
    if (fs.existsSync(backendPackagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(backendPackagePath, 'utf-8'));
        if (!packageJson.scripts?.dev) {
          errors.push('backend/package.json missing "dev" script');
        }
      } catch (error) {
        errors.push(`Failed to parse backend/package.json: ${error}`);
      }
    }
  }

  /**
   * Validate and log results
   * @param projectPath - Absolute path to project root
   * @param projectName - Project name for logging
   * @param deployServices - Array of deployment services
   * @returns True if valid, false otherwise
   */
  validateAndLog(
    projectPath: string,
    projectName: string,
    deployServices: string[] = ['netlify']
  ): boolean {
    const result = this.validate(projectPath, deployServices);

    if (result.errors.length > 0) {
      result.errors.forEach((error) => console.error(`   • ${error}`));
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach((warning) => console.warn(`   • ${warning}`));
    }

    if (result.valid) {
    }

    return result.valid;
  }
}

// Export singleton instance
export const templateValidator = new TemplateValidator();
