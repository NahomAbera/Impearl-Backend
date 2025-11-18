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
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  skills: {
    type: [String],
    default: []
  },
  expertiseTags: {
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
  resumeUrl: {
    type: String
  },
  bio: {
    type: String
  },
  experiences: {
    type: [
      {
        role: String,
        company: String,
        timeframe: String,
        skillsUsed: String,
        summary: String,
      }
    ],
    default: []
  },
  education: {
    type: [
      {
        school: String,
        degree: String,
        graduationYear: String,
      }
    ],
    default: []
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
