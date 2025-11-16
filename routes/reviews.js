const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const Review = require('../models/Review');
const BusinessProfile = require('../models/BusinessProfile');

router.post('/', auth, requireRole('business'), async (req, res) => {
  try {
    const profile = await BusinessProfile.findOne({ user: req.userId });
    const { targetType, targetId, rating, comment } = req.body;

    const review = await Review.create({
      reviewerBusiness: profile._id,
      targetType,
      targetId,
      rating,
      comment
    });

    res.status(201).json({ success: true, review });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ success: false, message: 'Error creating review' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { targetType, targetId } = req.query;
    const filter = {};
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;

    const reviews = await Review.find(filter)
      .populate('reviewerBusiness');

    res.json({ success: true, reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ success: false, message: 'Error fetching reviews' });
  }
});

module.exports = router;
