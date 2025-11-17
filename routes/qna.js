const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const QnASession = require('../models/QnASession');
const BusinessProfile = require('../models/BusinessProfile');

// Start a new Q&A session
router.post('/start', auth, requireRole('business'), async (req, res) => {
  try {
    const businessProfile = await BusinessProfile.findOne({ user: req.userId });
    if (!businessProfile) {
      return res.status(400).json({ success: false, message: 'Business profile required' });
    }

    const session = await QnASession.create({ business: businessProfile._id, answers: req.body.answers || {} });
    res.status(201).json({ success: true, session });
  } catch (error) {
    console.error('Start Q&A session error:', error);
    res.status(500).json({ success: false, message: 'Error starting Q&A session' });
  }
});

// Update answers / derived tags
router.put('/:id/answers', auth, requireRole('business'), async (req, res) => {
  try {
    const session = await QnASession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Q&A session not found' });
    }

    if (req.body.answers) session.answers = req.body.answers;
    if (req.body.derivedTags) session.derivedTags = req.body.derivedTags;

    await session.save();
    res.json({ success: true, session });
  } catch (error) {
    console.error('Update Q&A session error:', error);
    res.status(500).json({ success: false, message: 'Error updating Q&A session' });
  }
});

// Get latest session for logged in business
router.get('/latest', auth, requireRole('business'), async (req, res) => {
  try {
    const businessProfile = await BusinessProfile.findOne({ user: req.userId });
    if (!businessProfile) {
      return res.status(400).json({ success: false, message: 'Business profile required' });
    }

    const session = await QnASession.findOne({ business: businessProfile._id })
      .sort({ createdAt: -1 });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Get latest Q&A session error:', error);
    res.status(500).json({ success: false, message: 'Error fetching Q&A session' });
  }
});

module.exports = router;
