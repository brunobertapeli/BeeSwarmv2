import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  photoUrl: {
    type: String,
    trim: true
  },
  authProvider: {
    type: String,
    enum: ['google', 'facebook', 'github', 'email'],
    default: 'google'
  },
  plan: {
    type: String,
    enum: ['free', 'plus', 'premium'],
    default: 'free'
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'expired', 'canceled'],
    default: 'active'
  },
  stripeCustomerId: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster email lookups
userSchema.index({ email: 1 });

export default mongoose.model('User', userSchema);
