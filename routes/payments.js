const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const Contract = require('../models/Contract');
const BusinessProfile = require('../models/BusinessProfile');
const FreelancerProfile = require('../models/FreelancerProfile');
const ServiceProviderProfile = require('../models/ServiceProviderProfile');
const { getStripe, calculatePaymentBreakdown } = require('../utils/stripeClient');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

const ensureBusinessOwnsContract = async (contract, userId) => {
  const businessProfile = await BusinessProfile.findOne({ user: userId });
  if (!businessProfile || String(businessProfile._id) !== String(contract.business)) {
    throw new Error('You do not have access to this contract');
  }
};

const getPayeeProfile = async (contract) => {
  if (contract.targetType === 'freelancer') {
    return await FreelancerProfile.findById(contract.targetFreelancer);
  }
  return await ServiceProviderProfile.findById(contract.targetProvider);
};

router.post('/create-checkout-session', auth, requireRole('business'), async (req, res) => {
  try {
    const { contractId } = req.body;
    const contract = await Contract.findById(contractId);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });

    await ensureBusinessOwnsContract(contract, req.userId);

    if (contract.paymentStatus !== 'unpaid') {
      return res.status(400).json({ success: false, message: 'Contract already paid' });
    }

    const payeeProfile = await getPayeeProfile(contract);
    if (!payeeProfile || !payeeProfile.payoutsEnabled || !payeeProfile.stripeAccountId) {
      return res.status(400).json({ success: false, message: 'Payee has not completed payout setup' });
    }

    const stripe = getStripe();
    const { baseCents, feeCents, totalCents } = calculatePaymentBreakdown(contract.amountUsd || contract.agreedPrice);

    const successUrl = `${FRONTEND_URL}/contracts/${contract._id}?payment=success`;
    const cancelUrl = `${FRONTEND_URL}/contracts/${contract._id}?payment=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `IMPEARL Contract: ${contract.title}`,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        contractId: contract._id.toString(),
        baseAmountCents: baseCents.toString(),
        serviceFeeCents: feeCents.toString(),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    contract.checkoutSessionId = session.id;
    contract.paymentStatus = 'unpaid';
    await contract.save();

    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ success: false, message: error.message || 'Unable to initiate payment' });
  }
});

module.exports = router;
