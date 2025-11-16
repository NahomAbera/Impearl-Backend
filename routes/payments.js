const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const Payment = require('../models/Payment');
const Contract = require('../models/Contract');
const BusinessProfile = require('../models/BusinessProfile');
const Notification = require('../models/Notification');

router.post('/', auth, requireRole('business'), async (req, res) => {
  try {
    const { contractId, amount } = req.body;
    const contract = await Contract.findById(contractId);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });

    const businessProfile = await BusinessProfile.findOne({ user: req.userId });

    const payment = await Payment.create({
      contract: contract._id,
      payerBusiness: businessProfile._id,
      targetType: contract.targetType,
      payeeFreelancer: contract.targetFreelancer,
      payeeProvider: contract.targetProvider,
      amount,
      currency: contract.currency
    });

    await Notification.create({
      user: contract.business.user,
      type: 'payment',
      title: 'Payment completed',
      message: `Payment of $${amount} completed for ${contract.title}`,
      relatedContract: contract._id
    });

    res.status(201).json({ success: true, payment });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ success: false, message: 'Error creating payment' });
  }
});

module.exports = router;
