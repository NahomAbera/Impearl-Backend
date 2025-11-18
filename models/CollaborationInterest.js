const mongoose = require('mongoose');

const CollaborationInterestSchema = new mongoose.Schema(
  {
    senderUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderType: {
      type: String,
      enum: ['freelancer', 'service_provider'],
      required: true,
    },
    businessUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['sent', 'responded', 'dismissed'],
      default: 'sent',
    },
  },
  { timestamps: true }
);

CollaborationInterestSchema.index({ senderUser: 1, businessUser: 1 }, { unique: true });

module.exports = mongoose.model('CollaborationInterest', CollaborationInterestSchema);
