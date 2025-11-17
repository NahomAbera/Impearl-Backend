const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getMatchesForUser, buildFreelancerSummary, buildProviderSummary } = require('../utils/matching');
const FreelancerProfile = require('../models/FreelancerProfile');
const ServiceProviderProfile = require('../models/ServiceProviderProfile');

router.get('/top', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const matches = await getMatchesForUser(user);
    res.json({ success: true, matches });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ success: false, message: 'Error fetching matches' });
  }
});

router.post('/request', auth, requireRole(['freelancer', 'service_provider']), async (req, res) => {
  try {
    const { businessId, note } = req.body;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'Business ID is required' });
    }

    const businessUser = await User.findById(businessId);
    if (!businessUser || businessUser.userType !== 'business') {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    const businessProfile = businessUser.businessProfile || {};
    const sender = await User.findById(req.userId);

    const profile = req.userType === 'freelancer'
      ? await FreelancerProfile.findOne({ user: req.userId })
      : await ServiceProviderProfile.findOne({ user: req.userId });

    if (!profile || !profile.payoutsEnabled) {
      return res.status(400).json({ success: false, message: 'Complete Stripe payout setup before contacting businesses' });
    }

    const summary = sender.userType === 'freelancer'
      ? buildFreelancerSummary(sender)
      : buildProviderSummary(sender);

    const messageBody =
      note?.trim() ||
      `${summary.name || summary.companyName} would like to collaborate on your automation goals.`;

    await Notification.create({
      user: businessUser._id,
      type: 'collaboration_interest',
      title: `${summary.name || summary.companyName || 'A provider'} is interested in working with you`,
      message: `${messageBody}\nFocus: ${summary.expertise || (summary.industryFocus || []).join(', ') || 'General'}\nBusiness: ${businessProfile.businessName || 'Your team'}`,
    });

    res.json({ success: true, message: 'Collaboration request sent' });
  } catch (error) {
    console.error('Send collaboration request error:', error);
    res.status(500).json({ success: false, message: 'Error sending request' });
  }
});

module.exports = router;
