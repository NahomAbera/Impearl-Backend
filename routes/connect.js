const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const User = require('../models/User');
const FreelancerProfile = require('../models/FreelancerProfile');
const ServiceProviderProfile = require('../models/ServiceProviderProfile');
const { getStripe } = require('../utils/stripeClient');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

const getProfileModel = (userType) =>
  userType === 'freelancer' ? FreelancerProfile : ServiceProviderProfile;

const syncStripeFields = async (userId, userType, fields) => {
  const path = userType === 'freelancer' ? 'freelancerProfile' : 'serviceProviderProfile';
  const updates = {};
  if (typeof fields.stripeAccountId !== 'undefined') {
    updates[`${path}.stripeAccountId`] = fields.stripeAccountId;
  }
  if (typeof fields.stripeStatus !== 'undefined') {
    updates[`${path}.stripeStatus`] = fields.stripeStatus;
  }
  if (typeof fields.payoutsEnabled !== 'undefined') {
    updates[`${path}.payoutsEnabled`] = !!fields.payoutsEnabled;
  }
  if (Object.keys(updates).length) {
    await User.updateOne({ _id: userId }, { $set: updates });
  }
};

router.post('/onboard', auth, requireRole(['freelancer', 'service_provider']), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const profileModel = getProfileModel(req.userType);
    const profile = await profileModel.findOne({ user: req.userId });

    if (!profile) {
      return res.status(400).json({ success: false, message: 'Complete your profile before onboarding' });
    }

    const stripe = getStripe();
    let stripeAccountId = profile.stripeAccountId;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
      });
      stripeAccountId = account.id;
      profile.stripeAccountId = account.id;
      profile.stripeStatus = 'pending';
      await profile.save();
      await syncStripeFields(req.userId, req.userType, {
        stripeAccountId: account.id,
        stripeStatus: 'pending',
        payoutsEnabled: false,
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${FRONTEND_URL}/payout-setup?refresh=1`,
      return_url: `${FRONTEND_URL}/payout-setup?success=1`,
      type: 'account_onboarding',
    });

    await syncStripeFields(req.userId, req.userType, {
      stripeAccountId,
      stripeStatus: profile.stripeStatus,
      payoutsEnabled: profile.payoutsEnabled,
    });

    res.json({ success: true, url: accountLink.url });
  } catch (error) {
    console.error('Stripe onboarding error:', error);
    res.status(500).json({ success: false, message: 'Unable to start onboarding' });
  }
});

router.get('/status', auth, requireRole(['freelancer', 'service_provider']), async (req, res) => {
  try {
    const profileModel = getProfileModel(req.userType);
    const profile = await profileModel.findOne({ user: req.userId });

    if (!profile || !profile.stripeAccountId) {
      return res.json({ success: true, payoutsEnabled: false, stripeStatus: 'pending' });
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(profile.stripeAccountId);

    profile.payoutsEnabled = !!account.payouts_enabled;
    profile.stripeStatus = account.details_submitted ? 'enabled' : 'pending';
    await profile.save();
    await syncStripeFields(req.userId, req.userType, {
      stripeAccountId: profile.stripeAccountId,
      stripeStatus: profile.stripeStatus,
      payoutsEnabled: profile.payoutsEnabled,
    });

    res.json({ success: true, payoutsEnabled: profile.payoutsEnabled, stripeStatus: profile.stripeStatus });
  } catch (error) {
    console.error('Stripe status error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch payout status' });
  }
});

module.exports = router;
