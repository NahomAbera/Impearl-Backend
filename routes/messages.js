const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Contract = require('../models/Contract');
const BusinessProfile = require('../models/BusinessProfile');
const FreelancerProfile = require('../models/FreelancerProfile');
const ServiceProviderProfile = require('../models/ServiceProviderProfile');

const ensureAccess = async (contract, userId, userType) => {
  if (!contract) throw new Error('Contract not found');
  if (userType === 'admin') return;

  if (userType === 'business') {
    const biz = await BusinessProfile.findOne({ user: userId });
    if (biz && String(biz._id) === String(contract.business)) return;
    throw new Error('Unauthorized');
  }

  const profileModel = userType === 'freelancer' ? FreelancerProfile : ServiceProviderProfile;
  const profile = await profileModel.findOne({ user: userId });
  const targetDoc = userType === 'freelancer' ? contract.targetFreelancer : contract.targetProvider;
  const targetId = targetDoc?._id || targetDoc;
  if (profile && targetId && String(profile._id) === String(targetId)) return;
  throw new Error('Unauthorized');
};

router.get('/', auth, async (req, res) => {
  try {
    const { contractId } = req.query;
    const contract = await Contract.findById(contractId);
    await ensureAccess(contract, req.userId, req.userType);

    const messages = await Message.find({ contract: contractId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    const status = error.message === 'Unauthorized' ? 403 : error.message === 'Contract not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message || 'Error fetching messages' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { contractId, body, receiverId } = req.body;
    const contract = await Contract.findById(contractId);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    await ensureAccess(contract, req.userId, req.userType);

    const message = await Message.create({
      contract: contractId,
      sender: req.userId,
      receiver: receiverId,
      body
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ success: false, message: 'Error sending message' });
  }
});

module.exports = router;
