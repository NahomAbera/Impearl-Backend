const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const MarketplaceItem = require('../models/MarketplaceItem');
const FreelancerProfile = require('../models/FreelancerProfile');
const ServiceProviderProfile = require('../models/ServiceProviderProfile');

// Get marketplace items with optional filters
router.get('/', async (req, res) => {
  try {
    const { category, type, ownerType, search } = req.query;
    const query = {};

    if (category) query.category = category;
    if (type) query.type = type;
    if (ownerType) query.ownerType = ownerType;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { tags: new RegExp(search, 'i') }
      ];
    }

    const items = await MarketplaceItem.find(query)
      .populate('ownerFreelancer')
      .populate('ownerProvider');

    res.json({ success: true, items });
  } catch (error) {
    console.error('Get marketplace items error:', error);
    res.status(500).json({ success: false, message: 'Error fetching marketplace items' });
  }
});

// Get single item
router.get('/:id', async (req, res) => {
  try {
    const item = await MarketplaceItem.findById(req.params.id)
      .populate('ownerFreelancer')
      .populate('ownerProvider');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Marketplace item not found' });
    }

    res.json({ success: true, item });
  } catch (error) {
    console.error('Get marketplace item error:', error);
    res.status(500).json({ success: false, message: 'Error fetching marketplace item' });
  }
});

// Create marketplace item
router.post('/', auth, requireRole(['freelancer', 'service_provider']), async (req, res) => {
  try {
    const { type, name, description, category, tags, pricingModel, price, priceRange, websiteUrl } = req.body;
    const itemData = { type, name, description, category, pricingModel, price, priceRange, websiteUrl };

    if (tags) {
      itemData.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
    }

    if (req.userType === 'freelancer') {
      const profile = await FreelancerProfile.findOne({ user: req.userId });
      if (!profile) {
        return res.status(400).json({ success: false, message: 'Freelancer profile required' });
      }
      itemData.ownerType = 'freelancer';
      itemData.ownerFreelancer = profile._id;
    } else if (req.userType === 'service_provider') {
      const profile = await ServiceProviderProfile.findOne({ user: req.userId });
      if (!profile) {
        return res.status(400).json({ success: false, message: 'Service provider profile required' });
      }
      itemData.ownerType = 'service_provider';
      itemData.ownerProvider = profile._id;
    }

    const item = await MarketplaceItem.create(itemData);
    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error('Create marketplace item error:', error);
    res.status(500).json({ success: false, message: 'Error creating marketplace item' });
  }
});

module.exports = router;
