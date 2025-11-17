const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  reviewerBusiness: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessProfile'
  },
  reviewerUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewerType: {
    type: String,
    enum: ['business', 'freelancer', 'service_provider'],
    required: true
  },
  reviewerName: {
    type: String
  },
  targetType: {
    type: String,
    enum: ['business', 'freelancer', 'service_provider', 'marketplace_item'],
    required: true
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId
  },
  targetName: {
    type: String
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
