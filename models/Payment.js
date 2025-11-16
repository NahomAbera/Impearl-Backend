const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true
  },
  payerBusiness: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessProfile',
    required: true
  },
  targetType: {
    type: String,
    enum: ['freelancer', 'service_provider'],
    required: true
  },
  payeeFreelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FreelancerProfile'
  },
  payeeProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProviderProfile'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['completed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', PaymentSchema);
