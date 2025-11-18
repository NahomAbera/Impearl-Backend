const AuditLog = require('../models/AuditLog');

const recordAuditEvent = async ({ contractId, userId, eventType, details = {} }) => {
  try {
    await AuditLog.create({
      contract: contractId,
      user: userId,
      eventType,
      details,
    });
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

module.exports = { recordAuditEvent };
