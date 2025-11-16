const mongoose = require('mongoose');

const ContractSchema = new mongoose.Schema({
  engagementRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EngagementRequest',
    required: true
  },
  business: {
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
  agreedPrice: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Contract', ContractSchema);
