const mongoose = require('mongoose');

const MarketplaceItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['tool', 'service'],
    required: true
  },
  ownerType: {
    type: String,
    enum: ['platform', 'service_provider', 'freelancer'],
    required: true
  },
  ownerProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProviderProfile'
  },
  ownerFreelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FreelancerProfile'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  tags: {
    type: [String],
    default: []
  },
  pricingModel: {
    type: String,
    enum: ['subscription', 'fixed', 'hourly'],
    required: true
  },
  price: {
    type: Number
  },
  priceRange: {
    type: String,
    enum: ['low', 'mid', 'high']
  },
  websiteUrl: {
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

module.exports = mongoose.model('MarketplaceItem', MarketplaceItemSchema);
