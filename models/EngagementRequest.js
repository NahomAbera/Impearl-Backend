const mongoose = require('mongoose');

const LatestOfferSchema = new mongoose.Schema({
  fromRole: {
    type: String,
    enum: ['business', 'freelancer', 'service_provider'],
    required: true
  },
  price: {
    type: Number
  },
  terms: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const EngagementRequestSchema = new mongoose.Schema({
  fromBusiness: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessProfile',
    required: true
  },
  targetType: {
    type: String,
    enum: ['freelancer', 'service_provider'],
    required: true
  },
  targetFreelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FreelancerProfile'
  },
  targetProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProviderProfile'
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  initialPrice: {
    type: Number
  },
  currency: {
    type: String,
    default: 'USD'
  },
  proposedTerms: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'countered', 'expired'],
    default: 'pending'
  },
  latestOffer: LatestOfferSchema,
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EngagementRequest', EngagementRequestSchema);
