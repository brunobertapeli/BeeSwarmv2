import express from 'express';
import Template from '../models/Template.js';
import User from '../models/User.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sanitize input to prevent injection
const sanitizeString = (input, fieldName) => {
  if (typeof input !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = input.trim();
  if (!trimmed || trimmed.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  return trimmed;
};

// GET /api/v1/templates - Get all templates
router.get('/', async (req, res) => {
  try {
    const templates = await Template.find({}).sort({ createdAt: -1 });

    res.json({
      success: true,
      templates: templates.map(template => ({
        _id: template._id.toString(),
        id: template.id,
        name: template.name,
        description: template.description,
        longDescription: template.longDescription,
        type: template.type,
        category: template.category,
        githubUrl: template.githubUrl,
        requiredPlan: template.requiredPlan,
        requiredServices: template.requiredServices,
        demoUrl: template.demoUrl,
        techStack: template.techStack,
        libraries: template.libraries,
        deployServices: template.deployServices,
        imagePath: template.imagePath
      }))
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
});

// GET /api/v1/templates/:id - Get template by ID
router.get('/:id', async (req, res) => {
  try {
    const templateId = sanitizeString(req.params.id, 'Template ID');

    const template = await Template.findOne({ id: templateId });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      template: {
        _id: template._id.toString(),
        id: template.id,
        name: template.name,
        description: template.description,
        longDescription: template.longDescription,
        type: template.type,
        category: template.category,
        githubUrl: template.githubUrl,
        requiredPlan: template.requiredPlan,
        requiredServices: template.requiredServices,
        demoUrl: template.demoUrl,
        techStack: template.techStack,
        libraries: template.libraries,
        deployServices: template.deployServices,
        imagePath: template.imagePath
      }
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template'
    });
  }
});

// GET /api/v1/templates/:id/download - Download template zip file
router.get('/:id/download', async (req, res) => {
  try {
    const templateId = sanitizeString(req.params.id, 'Template ID');
    console.log('📥 Download request for template:', templateId);

    // SECURITY: Get user email from header
    const userEmail = req.headers['x-user-email'];
    if (!userEmail || typeof userEmail !== 'string') {
      console.error('❌ Missing user email in request');
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    console.log('👤 User email:', userEmail);

    // Fetch template from database
    const template = await Template.findOne({ id: templateId });

    if (!template) {
      console.error('❌ Template not found in database:', templateId);
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // SECURITY: Validate user plan before allowing download
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.error('❌ User not found:', userEmail);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log('📋 User plan:', user.plan, '| Required:', template.requiredPlan);
    console.log('🔔 Subscription status:', user.subscriptionStatus);

    // Check subscription status
    if (user.subscriptionStatus !== 'active' && template.requiredPlan !== 'free') {
      console.error('❌ Subscription not active:', user.subscriptionStatus);
      return res.status(403).json({
        success: false,
        error: 'Active subscription required',
        requiredPlan: template.requiredPlan,
        userPlan: user.plan,
        subscriptionStatus: user.subscriptionStatus
      });
    }

    // Plan hierarchy validation
    const planHierarchy = { free: 0, plus: 1, premium: 2 };
    const userPlanLevel = planHierarchy[user.plan] || 0;
    const requiredPlanLevel = planHierarchy[template.requiredPlan] || 0;

    if (userPlanLevel < requiredPlanLevel) {
      console.error('❌ Insufficient plan:', user.plan, '<', template.requiredPlan);
      return res.status(403).json({
        success: false,
        error: 'Plan upgrade required',
        requiredPlan: template.requiredPlan,
        userPlan: user.plan,
        subscriptionStatus: user.subscriptionStatus
      });
    }

    console.log('✅ Plan validation passed');
    console.log('');


    console.log('✅ Template found:', template.name);
    console.log('📄 Source path from DB:', template.sourcePath);

    if (!template.sourcePath) {
      console.error('❌ Template has no sourcePath field');
      return res.status(404).json({
        success: false,
        error: 'Template source file not configured'
      });
    }

    // Security: Prevent directory traversal attacks
    const safePath = path.basename(template.sourcePath);
    console.log('🔒 Safe path (basename):', safePath);

    // Use process.cwd() to get the project root directory
    const cwd = process.cwd();
    console.log('📂 Current working directory:', cwd);

    const templatesDir = path.join(cwd, 'templates');
    console.log('📁 Templates directory:', templatesDir);

    const filePath = path.join(templatesDir, safePath);
    console.log('📍 Full file path:', filePath);

    // Check if templates directory exists
    if (!fs.existsSync(templatesDir)) {
      console.error('❌ Templates directory does not exist:', templatesDir);
      // List what's in cwd
      console.log('📋 Contents of cwd:', fs.readdirSync(cwd));
      return res.status(500).json({
        success: false,
        error: 'Templates directory not found on server'
      });
    }

    console.log('📋 Templates directory contents:', fs.readdirSync(templatesDir));

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('❌ Template file not found:', filePath);
      return res.status(404).json({
        success: false,
        error: 'Template file not found on server'
      });
    }

    // Verify file exists and is within templates directory
    const realPath = fs.realpathSync(filePath);
    console.log('🔗 Real path (resolved):', realPath);

    if (!realPath.startsWith(templatesDir)) {
      console.error('🚨 Security: Path traversal attempt blocked:', template.sourcePath);
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get file stats
    const stat = fs.statSync(filePath);
    console.log('📊 File size:', stat.size, 'bytes');

    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safePath}"`);

    console.log('🚀 Starting file stream...');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('❌ Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to stream template file'
        });
      }
    });

    fileStream.on('end', () => {
      console.log('✅ File stream completed successfully');
    });

  } catch (error) {
    console.error('❌ Error downloading template:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to download template'
    });
  }
});

export default router;
