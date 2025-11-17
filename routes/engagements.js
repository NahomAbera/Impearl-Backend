const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const EngagementRequest = require('../models/EngagementRequest');
const BusinessProfile = require('../models/BusinessProfile');
const FreelancerProfile = require('../models/FreelancerProfile');
const ServiceProviderProfile = require('../models/ServiceProviderProfile');
const Contract = require('../models/Contract');
const Notification = require('../models/Notification');

const notifyUsers = async (userIds, payload) => {
  const docs = userIds
    .filter(Boolean)
    .map(user => ({ ...payload, user }));
  if (!docs.length) return;
  await Notification.insertMany(docs);
};

const getBusinessUserId = async (engagement) => {
  if (engagement.fromBusiness?.user) return engagement.fromBusiness.user;
  const businessProfile = await BusinessProfile.findById(engagement.fromBusiness);
  return businessProfile?.user;
};

const getTalentUserId = async (engagement) => {
  if (engagement.targetType === 'freelancer') {
    if (engagement.targetFreelancer?.user) return engagement.targetFreelancer.user;
    const profile = await FreelancerProfile.findById(engagement.targetFreelancer);
    return profile?.user;
  }
  if (engagement.targetProvider?.user) return engagement.targetProvider.user;
  const providerProfile = await ServiceProviderProfile.findById(engagement.targetProvider);
  return providerProfile?.user;
};

const notifyCounterparty = async (engagement, actorRole, payload) => {
  const recipient = actorRole === 'business'
    ? await getTalentUserId(engagement)
    : await getBusinessUserId(engagement);
  await notifyUsers([recipient], payload);
};

// Create engagement request
router.post('/', auth, requireRole('business'), async (req, res) => {
  try {
    const businessProfile = await BusinessProfile.findOne({ user: req.userId });
    if (!businessProfile) {
      return res.status(400).json({ success: false, message: 'Business profile required' });
    }

    const { targetType, targetId, title, description, initialPrice, currency, proposedTerms } = req.body;

    let freelancerProfile;
    let serviceProviderProfile;

    const requestData = {
      fromBusiness: businessProfile._id,
      targetType,
      title,
      description,
      initialPrice,
      currency,
      proposedTerms,
      latestOffer: {
        fromRole: 'business',
        price: initialPrice,
        terms: proposedTerms,
        timestamp: new Date()
      }
    };

    if (targetType === 'freelancer') {
      freelancerProfile = await FreelancerProfile.findById(targetId);
      if (!freelancerProfile) {
        freelancerProfile = await FreelancerProfile.findOne({ user: targetId });
      }
      if (!freelancerProfile) {
        return res.status(404).json({ success: false, message: 'Target freelancer not found' });
      }
      requestData.targetFreelancer = freelancerProfile._id;
    } else {
      serviceProviderProfile = await ServiceProviderProfile.findById(targetId);
      if (!serviceProviderProfile) {
        serviceProviderProfile = await ServiceProviderProfile.findOne({ user: targetId });
      }
      if (!serviceProviderProfile) {
        return res.status(404).json({ success: false, message: 'Target service provider not found' });
      }
      requestData.targetProvider = serviceProviderProfile._id;
    }

    const engagementRequest = await EngagementRequest.create(requestData);

    // Notify target user
    const targetUser = requestData.targetFreelancer ? freelancerProfile.user : serviceProviderProfile.user;
    await notifyUsers([targetUser], {
      type: 'engagement_request',
      title: 'New engagement request',
      message: `${title}`,
      relatedRequest: engagementRequest._id
    });

    res.status(201).json({ success: true, engagementRequest });
  } catch (error) {
    console.error('Create engagement request error:', error);
    res.status(500).json({ success: false, message: 'Error creating engagement request' });
  }
});

// Get engagements for current user
router.get('/my', auth, async (req, res) => {
  try {
    let filter = {};

    if (req.userType === 'business') {
      const businessProfile = await BusinessProfile.findOne({ user: req.userId });
      filter.fromBusiness = businessProfile?._id;
    } else if (req.userType === 'freelancer') {
      const freelancerProfile = await FreelancerProfile.findOne({ user: req.userId });
      filter.targetFreelancer = freelancerProfile?._id;
    } else if (req.userType === 'service_provider') {
      const serviceProvider = await ServiceProviderProfile.findOne({ user: req.userId });
      filter.targetProvider = serviceProvider?._id;
    }

    const engagements = await EngagementRequest.find(filter)
      .populate('fromBusiness')
      .populate('targetFreelancer')
      .populate('targetProvider')
      .populate('contract');

    res.json({ success: true, engagements });
  } catch (error) {
    console.error('Get engagements error:', error);
    res.status(500).json({ success: false, message: 'Error fetching engagements' });
  }
});

// Accept engagement
router.post('/:id/accept', auth, requireRole(['freelancer', 'service_provider', 'business']), async (req, res) => {
  try {
    const engagement = await EngagementRequest.findById(req.params.id)
      .populate('fromBusiness')
      .populate('targetFreelancer')
      .populate('targetProvider');

    if (!engagement) return res.status(404).json({ success: false, message: 'Engagement not found' });

    const lastRole = engagement.latestOffer?.fromRole;
    if (lastRole === req.userType) {
      return res.status(400).json({ success: false, message: 'Awaiting response from other party' });
    }

    if (req.userType === 'business' && engagement.status !== 'countered') {
      return res.status(400).json({ success: false, message: 'Only counteroffers can be accepted by businesses' });
    }

    if (req.userType !== 'business' && engagement.status !== 'pending' && engagement.status !== 'countered') {
      return res.status(400).json({ success: false, message: 'Engagement is not open for acceptance' });
    }

    engagement.status = 'accepted';

    const payeeProfile = engagement.targetType === 'freelancer'
      ? await FreelancerProfile.findById(engagement.targetFreelancer)
      : await ServiceProviderProfile.findById(engagement.targetProvider);

    if (!payeeProfile || !payeeProfile.payoutsEnabled || !payeeProfile.stripeAccountId) {
      return res.status(400).json({ success: false, message: 'Payee must complete payout setup before contracts can be created.' });
    }

    const contractData = {
      engagementRequest: engagement._id,
      business: engagement.fromBusiness,
      targetType: engagement.targetType,
      title: engagement.title,
      description: engagement.description,
      agreedPrice: engagement.latestOffer?.price || engagement.initialPrice,
      currency: engagement.currency,
      amountUsd: engagement.latestOffer?.price || engagement.initialPrice,
    };

    if (engagement.targetType === 'freelancer') {
      contractData.targetFreelancer = engagement.targetFreelancer;
    } else {
      contractData.targetProvider = engagement.targetProvider;
    }

    const contract = await Contract.create(contractData);
    engagement.contract = contract._id;
    await engagement.save();

    const recipientUser = req.userType === 'business'
      ? await getTalentUserId(engagement)
      : engagement.fromBusiness.user;

    await notifyUsers([recipientUser], {
      type: 'engagement_accepted',
      title: 'Engagement accepted',
      message: `${engagement.title} was accepted`,
      relatedRequest: engagement._id,
      relatedContract: contract._id
    });

    res.json({ success: true, engagement, contract });
  } catch (error) {
    console.error('Accept engagement error:', error);
    res.status(500).json({ success: false, message: 'Error accepting engagement' });
  }
});

// Decline engagement
router.post('/:id/decline', auth, requireRole(['freelancer', 'service_provider', 'business']), async (req, res) => {
  try {
    const engagement = await EngagementRequest.findById(req.params.id)
      .populate('fromBusiness')
      .populate('targetFreelancer')
      .populate('targetProvider');
    if (!engagement) return res.status(404).json({ success: false, message: 'Engagement not found' });

    const lastRole = engagement.latestOffer?.fromRole;
    if (lastRole === req.userType) {
      return res.status(400).json({ success: false, message: 'Awaiting response from other party' });
    }

    engagement.status = 'declined';
    await engagement.save();

    await notifyCounterparty(engagement, req.userType, {
      type: 'engagement_declined',
      title: 'Engagement declined',
      message: `${engagement.title} was declined`,
      relatedRequest: engagement._id
    });

    res.json({ success: true, engagement });
  } catch (error) {
    console.error('Decline engagement error:', error);
    res.status(500).json({ success: false, message: 'Error declining engagement' });
  }
});

// Counteroffer
router.post('/:id/counter', auth, requireRole(['freelancer', 'service_provider', 'business']), async (req, res) => {
  try {
    const engagement = await EngagementRequest.findById(req.params.id)
      .populate('fromBusiness')
      .populate('targetFreelancer')
      .populate('targetProvider');
    if (!engagement) return res.status(404).json({ success: false, message: 'Engagement not found' });

    const { price, terms } = req.body;

    const lastRole = engagement.latestOffer?.fromRole;
    if (lastRole === req.userType) {
      return res.status(400).json({ success: false, message: 'Awaiting response from other party' });
    }

    engagement.status = 'countered';
    engagement.latestOffer = {
      fromRole: req.userType,
      price,
      terms,
      timestamp: new Date()
    };

    await engagement.save();

    await notifyCounterparty(engagement, req.userType, {
      type: 'engagement_counter',
      title: 'New counteroffer',
      message: `${engagement.title} has a new counteroffer`,
      relatedRequest: engagement._id
    });

    res.json({ success: true, engagement });
  } catch (error) {
    console.error('Counter engagement error:', error);
    res.status(500).json({ success: false, message: 'Error updating engagement' });
  }
});

module.exports = router;
