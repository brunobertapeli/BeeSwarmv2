import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Sanitize input to prevent injection
const sanitizeEmail = (email) => {
  if (typeof email !== 'string') {
    throw new Error('Email must be a string');
  }
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || trimmed.length === 0) {
    throw new Error('Email cannot be empty');
  }
  return trimmed;
};

// GET /api/v1/users/:email - Get user by email
router.get('/:email', async (req, res) => {
  try {
    const email = sanitizeEmail(req.params.email);

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        photoUrl: user.photoUrl,
        authProvider: user.authProvider,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// POST /api/v1/users - Create new user
router.post('/', async (req, res) => {
  try {
    const { email, name, photoUrl, authProvider } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const sanitizedEmail = sanitizeEmail(email);

    // Check if user already exists
    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    const user = new User({
      email: sanitizedEmail,
      name: name || sanitizedEmail.split('@')[0],
      photoUrl,
      authProvider: authProvider || 'google',
      plan: 'free',
      subscriptionStatus: 'active'
    });

    await user.save();

    res.status(201).json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        photoUrl: user.photoUrl,
        authProvider: user.authProvider,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

// POST /api/v1/users/validate-plan - Validate user plan for premium features
router.post('/validate-plan', async (req, res) => {
  try {
    const { email, requiredPlan } = req.body;

    if (!email || !requiredPlan) {
      return res.status(400).json({
        success: false,
        error: 'Email and requiredPlan are required'
      });
    }

    const sanitizedEmail = sanitizeEmail(email);
    const user = await User.findOne({ email: sanitizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Plan hierarchy: free < plus < premium
    const planHierarchy = { free: 0, plus: 1, premium: 2 };
    const hasAccess = planHierarchy[user.plan] >= planHierarchy[requiredPlan];

    res.json({
      success: true,
      hasAccess,
      userPlan: user.plan,
      requiredPlan,
      subscriptionStatus: user.subscriptionStatus
    });
  } catch (error) {
    console.error('Error validating plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate plan'
    });
  }
});

export default router;
