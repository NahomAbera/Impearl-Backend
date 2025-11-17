const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const Contract = require('../models/Contract');
const BusinessProfile = require('../models/BusinessProfile');
const FreelancerProfile = require('../models/FreelancerProfile');
const ServiceProviderProfile = require('../models/ServiceProviderProfile');
const Notification = require('../models/Notification');
const { getStripe, calculatePaymentBreakdown } = require('../utils/stripeClient');
const ensureBusinessOwnership = async (contract, userId) => {
  const businessProfile = await BusinessProfile.findOne({ user: userId });
  if (businessProfile && String(businessProfile._id) === String(contract.business)) {
    return;
  }

  if (contract.business?.user && String(contract.business.user) === String(userId)) {
    return;
  }

  const loadedBusiness = await BusinessProfile.findById(contract.business);
  if (loadedBusiness && String(loadedBusiness.user) === String(userId)) {
    return;
  }

  throw new Error('You do not have access to this contract');
};

const getPayeeProfile = async (contract) => {
  if (contract.targetType === 'freelancer') {
    return await FreelancerProfile.findById(contract.targetFreelancer);
  }
  return await ServiceProviderProfile.findById(contract.targetProvider);
};
const ensureContractAccess = async (contract, userId, userType) => {
  if (userType === 'admin') return;
  if (userType === 'business') {
    await ensureBusinessOwnership(contract, userId);
    return;
  }
  const profileModel = userType === 'freelancer' ? FreelancerProfile : ServiceProviderProfile;
  const profile = await profileModel.findOne({ user: userId });
  const targetId = userType === 'freelancer' ? contract.targetFreelancer : contract.targetProvider;
  if (!profile || !targetId || String(profile._id) !== String(targetId)) {
    throw new Error('You do not have access to this contract');
  }
};

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
    await ensureContractAccess(contract, req.userId, req.userType);
    res.json({ success: true, contract });
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(error.message === 'You do not have access to this contract' ? 403 : 500).json({ success: false, message: error.message || 'Error fetching contract' });
  }
});

router.post('/:id/complete', auth, requireRole('business'), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    await ensureBusinessOwnership(contract, req.userId);

    contract.status = 'completed';
    await contract.save();

    res.json({ success: true, contract });
  } catch (error) {
    console.error('Complete contract error:', error);
    res.status(500).json({ success: false, message: 'Error updating contract' });
  }
});

router.post('/:id/release', auth, requireRole(['business', 'admin']), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });

    if (contract.paymentStatus !== 'held') {
      return res.status(400).json({ success: false, message: 'Funds are not currently held' });
    }

    if (req.userType === 'business') {
      await ensureBusinessOwnership(contract, req.userId);
    }

    const payeeProfile = await getPayeeProfile(contract);
    if (!payeeProfile || !payeeProfile.stripeAccountId) {
      return res.status(400).json({ success: false, message: 'Payee does not have a payout account' });
    }

    const stripe = getStripe();
    const { baseCents } = calculatePaymentBreakdown(contract.amountUsd || contract.agreedPrice);
    const transfer = await stripe.transfers.create({
      amount: baseCents,
      currency: 'usd',
      destination: payeeProfile.stripeAccountId,
    });

    contract.paymentStatus = 'released';
    contract.payoutTransferId = transfer.id;
    contract.releasedAt = new Date();
    contract.freelancerRequestedRelease = false;
    await contract.save();

    const businessProfile = await BusinessProfile.findById(contract.business);
    await Notification.create({
      user: businessProfile?.user,
      type: 'payment_released',
      title: 'Payment released',
      message: `${contract.title} funds have been released to the payee.`,
      relatedContract: contract._id,
    }).catch(() => {});

    await Notification.create({
      user: payeeProfile.user,
      type: 'payment_released',
      title: 'Payment received',
      message: `Funds for ${contract.title} were released to your Stripe account.`,
      relatedContract: contract._id,
    }).catch(() => {});

    res.json({ success: true, contract });
  } catch (error) {
    console.error('Release payment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error releasing payment' });
  }
});

router.post('/:id/request-release', auth, requireRole(['freelancer', 'service_provider']), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    if (contract.paymentStatus !== 'held') {
      return res.status(400).json({ success: false, message: 'Payment is not held in escrow' });
    }

    const payeeProfile = await getPayeeProfile(contract);
    if (!payeeProfile || String(payeeProfile.user) !== String(req.userId)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this contract' });
    }

    contract.freelancerRequestedRelease = true;
    await contract.save();

    const businessProfile = await BusinessProfile.findById(contract.business);
    const payeeName = payeeProfile.companyName || payeeProfile.headline || payeeProfile.name || 'Payee';
    await Notification.create({
      user: businessProfile?.user,
      type: 'release_requested',
      title: 'Release requested',
      message: `${payeeName} requested payment release for ${contract.title}.`,
      relatedContract: contract._id,
    }).catch(() => {});

    res.json({ success: true, contract });
  } catch (error) {
    console.error('Request release error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error requesting release' });
  }
});

router.post('/:id/dispute', auth, requireRole('business'), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    if (contract.paymentStatus !== 'held') {
      return res.status(400).json({ success: false, message: 'Only held funds can be disputed' });
    }
    await ensureBusinessOwnership(contract, req.userId);

    contract.paymentStatus = 'disputed';
    await contract.save();

    const payeeProfile = await getPayeeProfile(contract);
    await Notification.create({
      user: payeeProfile?.user,
      type: 'payment_disputed',
      title: 'Payment disputed',
      message: `The business opened a dispute for ${contract.title}.`,
      relatedContract: contract._id,
    }).catch(() => {});

    res.json({ success: true, contract });
  } catch (error) {
    console.error('Dispute payment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error opening dispute' });
  }
});

module.exports = router;
