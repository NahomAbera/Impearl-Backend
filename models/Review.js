const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  reviewerBusiness: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessProfile',
    required: true
  },
  targetType: {
    type: String,
    enum: ['freelancer', 'service_provider', 'marketplace_item'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  comment: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Review', ReviewSchema);
