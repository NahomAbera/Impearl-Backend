const mongoose = require('mongoose');

const QnASessionSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessProfile',
    required: true
  },
  answers: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  derivedTags: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('QnASession', QnASessionSchema);
