const mongoose = require('mongoose');

const ServiceProviderProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  websiteUrl: {
    type: String
  },
  headline: { type: String },
  valueProposition: { type: String },
  industryFocus: { type: [String], default: [] },
  integrations: { type: [String], default: [] },
  description: { type: String },
  offerings: [
    {
      name: String,
      promise: String,
      priceRange: String,
      timeline: String,
    },
  ],
  caseStudies: [
    {
      client: String,
      challenge: String,
      solution: String,
      impact: String,
    },
  ],
  supportChannels: { type: [String], default: [] },
  onboardingTime: { type: String },
  pricingModel: { type: String },
  teamSize: { type: String },
  contactName: { type: String },
  contactEmail: { type: String },
  idealCustomerProfile: { type: String },
  successMetrics: { type: String },
  differentiators: { type: String },
  certifications: { type: [String], default: [] },
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

module.exports = mongoose.model('ServiceProviderProfile', ServiceProviderProfileSchema);
