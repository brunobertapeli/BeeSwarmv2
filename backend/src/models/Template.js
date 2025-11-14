import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  longDescription: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['frontend', 'fullstack', 'backend'],
    default: 'fullstack'
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  githubUrl: {
    type: String,
    trim: true
  },
  sourcePath: {
    type: String,
    trim: true,
    required: true
  },
  requiredPlan: {
    type: String,
    enum: ['free', 'plus', 'premium'],
    default: 'free'
  },
  requiredServices: {
    type: [String],
    default: []
  },
  demoUrl: {
    type: String,
    trim: true
  },
  techStack: {
    type: [String],
    default: []
  },
  libraries: [{
    name: String,
    description: String
  }],
  deployServices: {
    type: [String],
    default: []
  },
  imagePath: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster lookups
templateSchema.index({ id: 1 });
templateSchema.index({ category: 1 });
templateSchema.index({ requiredPlan: 1 });

export default mongoose.model('Template', templateSchema);
