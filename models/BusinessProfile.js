const mongoose = require('mongoose');

const BusinessProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    sparse: true
  },
  businessName: {
    type: String,
    required: true,
    trim: true
  },
  industry: {
    type: String,
    enum: ['technology', 'retail', 'healthcare', 'finance', 'manufacturing', 'education', 'hospitality', 'other'],
    required: true
  },
  companySize: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-500', '500+']
  },
  goals: {
    type: String
  },
  budgetRange: {
    type: String
  },
  websiteUrl: {
    type: String
  },
  description: {
    type: String
  },
  currentTools: {
    type: String
  },
  challenges: {
    type: String
  },
  preferredTimeline: {
    type: String
  },
  ratingAvg: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  ratingCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BusinessProfile', BusinessProfileSchema);
