const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const Contract = require('../models/Contract');
const { getStripe } = require('../utils/stripeClient');

router.post('/contracts/:id/refund', auth, requireRole('admin'), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    if (!contract.paymentIntentId) {
      return res.status(400).json({ success: false, message: 'No payment to refund' });
    }

    const stripe = getStripe();
    await stripe.refunds.create({ payment_intent: contract.paymentIntentId });

    contract.paymentStatus = 'refunded';
    await contract.save();

    res.json({ success: true, contract });
  } catch (error) {
    console.error('Admin refund error:', error);
    res.status(500).json({ success: false, message: error.message || 'Unable to refund payment' });
  }
});

module.exports = router;
