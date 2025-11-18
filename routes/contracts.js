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
const { recordAuditEvent } = require('../utils/auditLogger');
const { sendEmail } = require('../utils/mailer');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
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
  const targetDoc = userType === 'freelancer' ? contract.targetFreelancer : contract.targetProvider;
  const targetId = targetDoc?._id || targetDoc;
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

router.get('/:id/history', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    await ensureContractAccess(contract, req.userId, req.userType);

    const history = await AuditLog.find({ contract: contract._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, history });
  } catch (error) {
    console.error('Get contract history error:', error);
    res.status(500).json({ success: false, message: 'Error fetching history' });
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
    const payeeName = payeeProfile.companyName || payeeProfile.headline || payeeProfile.name || 'Payee';

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

    recordAuditEvent({
      contractId: contract._id,
      userId: req.userId,
      eventType: 'payment_released',
      details: { transferId: transfer.id, amountCents: baseCents },
    });

    const businessUser = await User.findById(businessProfile?.user);
    const payeeUser = await User.findById(payeeProfile.user);
    if (businessUser?.email) {
      sendEmail({
        to: businessUser.email,
        subject: `Payment released for ${contract.title}`,
        text: `You released $${(baseCents / 100).toFixed(2)} to ${payeeName} for "${contract.title}".`,
      });
    }
    if (payeeUser?.email) {
      sendEmail({
        to: payeeUser.email,
        subject: `Funds released for ${contract.title}`,
        text: `The business released $${(baseCents / 100).toFixed(2)} to your Stripe account for "${contract.title}".`,
      });
    }
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

    recordAuditEvent({
      contractId: contract._id,
      userId: req.userId,
      eventType: 'release_requested',
    });

    if (businessProfile?.user) {
      const bizUser = await User.findById(businessProfile.user);
      if (bizUser?.email) {
        sendEmail({
          to: bizUser.email,
          subject: `Payment release requested for ${contract.title}`,
          text: `${payeeName} asked you to release funds for "${contract.title}". Review the work and release when ready.`,
        });
      }
    }
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

    recordAuditEvent({
      contractId: contract._id,
      userId: req.userId,
      eventType: 'dispute_opened',
    });

    const payeeUser = await User.findById(payeeProfile?.user);
    if (payeeUser?.email) {
      sendEmail({
        to: payeeUser.email,
        subject: `Dispute opened for ${contract.title}`,
        text: `The business opened a dispute for "${contract.title}". Please prepare any supporting materials.`,
      });
    }
  } catch (error) {
    console.error('Dispute payment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error opening dispute' });
  }
});

module.exports = router;
