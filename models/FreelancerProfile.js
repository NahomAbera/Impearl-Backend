const mongoose = require('mongoose');

const FreelancerProfileSchema = new mongoose.Schema({
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
  headline: {
    type: String,
    trim: true
  },
  skills: {
    type: [String],
    default: []
  },
  yearsExperience: {
    type: String,
    enum: ['0-1', '1-3', '3-5', '5-10', '10+']
  },
  hourlyRate: {
    type: Number,
    min: 0
  },
  availability: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'hourly', 'not-available']
  },
  industries: {
    type: [String],
    default: []
  },
  portfolioUrl: {
    type: String
  },
  bio: {
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
  },
  stripeAccountId: {
    type: String,
    default: null
  },
  stripeStatus: {
    type: String,
    enum: ['pending', 'enabled', 'disabled'],
    default: 'pending'
  },
  payoutsEnabled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FreelancerProfile', FreelancerProfileSchema);
