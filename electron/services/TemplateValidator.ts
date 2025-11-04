import fs from 'fs';
import path from 'path';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Required file/directory structure for CodeDeck templates
 */
interface StructureRequirement {
  path: string;
  type: 'file' | 'directory';
  required: boolean;
  description: string;
}

/**
 * TemplateValidator Service
 *
 * Validates that cloned templates follow the required CodeDeck structure
 */
class TemplateValidator {
  private requirements: StructureRequirement[] = [
    {
      path: 'package.json',
      type: 'file',
      required: true,
      description: 'Root package.json with netlify-cli dependency'
    },
    {
      path: 'netlify.toml',
      type: 'file',
      required: true,
      description: 'Netlify configuration file'
    },
    {
      path: 'frontend',
      type: 'directory',
      required: true,
      description: 'Frontend application directory'
    },
    {
      path: 'frontend/package.json',
      type: 'file',
      required: true,
      description: 'Frontend package.json with React and Vite'
    },
    {
      path: 'frontend/vite.config.ts',
      type: 'file',
      required: false,
      description: 'Vite configuration (recommended)'
    },
    {
      path: 'netlify/functions',
      type: 'directory',
      required: false,
      description: 'Serverless functions directory'
    }
  ];

  /**
   * Validate template structure
   * @param projectPath - Absolute path to project root
   * @returns Validation result with errors and warnings
   */
  validate(projectPath: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if project directory exists
    if (!fs.existsSync(projectPath)) {
      return {
        valid: false,
        errors: [`Project directory does not exist: ${projectPath}`],
        warnings: []
      };
    }

    // Validate each requirement
    for (const req of this.requirements) {
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

    // Additional validation: Check for netlify-cli in root package.json
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

    // Additional validation: Check frontend port configuration
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

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate and log results
   * @param projectPath - Absolute path to project root
   * @param projectName - Project name for logging
   * @returns True if valid, false otherwise
   */
  validateAndLog(projectPath: string, projectName: string): boolean {
    console.log(`🔍 Validating template structure for: ${projectName}`);

    const result = this.validate(projectPath);

    if (result.errors.length > 0) {
      console.log(`❌ Template validation failed for ${projectName}:`);
      result.errors.forEach(error => console.log(`   • ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log(`⚠️ Template validation warnings for ${projectName}:`);
      result.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    if (result.valid) {
      console.log(`✅ Template structure valid for ${projectName}`);
    }

    return result.valid;
  }
}

// Export singleton instance
export const templateValidator = new TemplateValidator();
