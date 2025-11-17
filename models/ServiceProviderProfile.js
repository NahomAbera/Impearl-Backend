const mongoose = require('mongoose');

const ServiceProviderProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  websiteUrl: {
    type: String
  },
  industryFocus: {
    type: [String],
    default: []
  },
  integrations: {
    type: [String],
    default: []
  },
  description: {
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

module.exports = mongoose.model('ServiceProviderProfile', ServiceProviderProfileSchema);
