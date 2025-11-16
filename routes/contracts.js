const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const Contract = require('../models/Contract');
const BusinessProfile = require('../models/BusinessProfile');
const FreelancerProfile = require('../models/FreelancerProfile');
const ServiceProviderProfile = require('../models/ServiceProviderProfile');

router.get('/my', auth, async (req, res) => {
  try {
    let filter = {};

    if (req.userType === 'business') {
      const profile = await BusinessProfile.findOne({ user: req.userId });
      filter.business = profile?._id;
    } else if (req.userType === 'freelancer') {
      const profile = await FreelancerProfile.findOne({ user: req.userId });
      filter.targetFreelancer = profile?._id;
    } else if (req.userType === 'service_provider') {
      const profile = await ServiceProviderProfile.findOne({ user: req.userId });
      filter.targetProvider = profile?._id;
    }

    const contracts = await Contract.find(filter)
      .populate('engagementRequest')
      .populate('business')
      .populate('targetFreelancer')
      .populate('targetProvider');
    res.json({ success: true, contracts });
  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({ success: false, message: 'Error fetching contracts' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('engagementRequest')
      .populate('business')
      .populate('targetFreelancer')
      .populate('targetProvider');

    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    res.json({ success: true, contract });
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({ success: false, message: 'Error fetching contract' });
  }
});

router.post('/:id/complete', auth, requireRole('business'), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });

    contract.status = 'completed';
    await contract.save();

    res.json({ success: true, contract });
  } catch (error) {
    console.error('Complete contract error:', error);
    res.status(500).json({ success: false, message: 'Error updating contract' });
  }
});

module.exports = router;
