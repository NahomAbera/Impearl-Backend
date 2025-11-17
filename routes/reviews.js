const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const Review = require('../models/Review');
const User = require('../models/User');
const BusinessProfile = require('../models/BusinessProfile');
const FreelancerProfile = require('../models/FreelancerProfile');
const ServiceProviderProfile = require('../models/ServiceProviderProfile');

const PROFILE_MODELS = {
  business: BusinessProfile,
  freelancer: FreelancerProfile,
  service_provider: ServiceProviderProfile,
};

const USER_PROFILE_PATHS = {
  business: 'businessProfile',
  freelancer: 'freelancerProfile',
  service_provider: 'serviceProviderProfile',
};

const allowedReviewerRoles = ['business', 'freelancer', 'service_provider'];
const allowedTargetTypes = ['business', 'freelancer', 'service_provider'];

const getDisplayName = (user) => {
  if (!user) return '';
  if (user.userType === 'business') {
    return user.businessProfile?.businessName || user.email;
  }
  if (user.userType === 'freelancer') {
    return user.freelancerProfile?.name || user.email;
  }
  if (user.userType === 'service_provider') {
    return user.serviceProviderProfile?.companyName || user.email;
  }
  return user.email;
};

const hasCompletedProfile = (user) => {
  if (!user) return false;
  if (user.userType === 'business') {
    return !!user.businessProfile?.businessName;
  }
  if (user.userType === 'freelancer') {
    return !!user.freelancerProfile?.name;
  }
  if (user.userType === 'service_provider') {
    return !!user.serviceProviderProfile?.companyName;
  }
  return false;
};

const resolveTargetContext = async (targetType, identifier) => {
  if (!allowedTargetTypes.includes(targetType)) {
    return null;
  }
  if (!identifier || !mongoose.Types.ObjectId.isValid(identifier)) {
    return null;
  }

  let user = await User.findById(identifier);
  let profile = null;

  if (user && user.userType === targetType) {
    const Model = PROFILE_MODELS[targetType];
    profile = await Model.findOne({ user: user._id });
  } else {
    const Model = PROFILE_MODELS[targetType];
    profile = await Model.findById(identifier);
    if (profile) {
      user = await User.findById(profile.user);
    }
  }

  if (!user || !profile || user.userType !== targetType) {
    return null;
  }

  return { user, profile };
};

const recalcRatings = async (targetType, context) => {
  if (!allowedTargetTypes.includes(targetType) || !context?.userId) {
    return;
  }

  const userId = new mongoose.Types.ObjectId(context.userId);
  const profileId = context.profileId ? new mongoose.Types.ObjectId(context.profileId) : null;
  const match = {
    targetType,
    $or: [{ targetUser: userId }],
  };
  if (profileId) {
    match.$or.push({ targetId: profileId });
  }

  const stats = await Review.aggregate([
    { $match: match },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const ratingAvg = stats[0]?.avg ? Number(stats[0].avg.toFixed(2)) : 0;
  const ratingCount = stats[0]?.count || 0;
  const Model = PROFILE_MODELS[targetType];

  if (Model) {
    const profileQuery = [{ user: userId }];
    if (profileId) {
      profileQuery.push({ _id: profileId });
    }
    await Model.updateOne({ $or: profileQuery }, { ratingAvg, ratingCount });
  }

  const profilePath = USER_PROFILE_PATHS[targetType];
  if (profilePath) {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          [`${profilePath}.rating`]: ratingAvg,
          [`${profilePath}.reviewCount`]: ratingCount,
        },
      }
    );
  }
};

router.post('/', auth, requireRole(allowedReviewerRoles), async (req, res) => {
  try {
    const { targetType, targetUserId, targetId, rating, comment } = req.body;

    if (!allowedTargetTypes.includes(targetType)) {
      return res.status(400).json({ success: false, message: 'Unsupported review target' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const reviewerUser = await User.findById(req.userId);
    if (!reviewerUser || !hasCompletedProfile(reviewerUser)) {
      return res.status(400).json({ success: false, message: 'Complete your profile before leaving reviews' });
    }

    const targetIdentifier = targetUserId || targetId;
    const targetContext = await resolveTargetContext(targetType, targetIdentifier);
    if (!targetContext) {
      return res.status(404).json({ success: false, message: 'Target profile not found' });
    }

    if (String(targetContext.user._id) === String(req.userId)) {
      return res.status(400).json({ success: false, message: 'You cannot review yourself' });
    }

    const reviewPayload = {
      reviewerUser: reviewerUser._id,
      reviewerType: reviewerUser.userType,
      reviewerName: getDisplayName(reviewerUser),
      targetType,
      targetUser: targetContext.user._id,
      targetId: targetContext.profile._id,
      targetName: getDisplayName(targetContext.user),
      rating,
      comment,
    };

    if (reviewerUser.userType === 'business') {
      const businessProfile = await BusinessProfile.findOne({ user: reviewerUser._id });
      if (!businessProfile) {
        return res.status(400).json({ success: false, message: 'Business profile required to review' });
      }
      reviewPayload.reviewerBusiness = businessProfile._id;
    }

    const review = await Review.create(reviewPayload);
    await recalcRatings(targetType, { userId: targetContext.user._id, profileId: targetContext.profile._id });

    res.status(201).json({ success: true, review });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ success: false, message: 'Error creating review' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { targetType, targetUserId, targetId } = req.query;
    const filter = {};
    if (targetType) filter.targetType = targetType;

    const or = [];
    if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
      or.push({ targetUser: new mongoose.Types.ObjectId(targetUserId) });
    }
    if (targetId && mongoose.Types.ObjectId.isValid(targetId)) {
      or.push({ targetId: new mongoose.Types.ObjectId(targetId) });
    }
    if (or.length) {
      filter.$or = or;
    }

    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ success: false, message: 'Error fetching reviews' });
  }
});

module.exports = router;
