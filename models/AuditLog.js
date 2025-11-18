const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  eventType: {
    type: String,
    required: true,
  },
  details: {
    type: Object,
    default: {},
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
