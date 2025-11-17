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

const getOwnerFilter = async (userId, userType) => {
  if (userType === 'freelancer') {
    const profile = await FreelancerProfile.findOne({ user: userId });
    return profile ? { ownerType: 'freelancer', ownerFreelancer: profile._id } : null;
  }
  if (userType === 'service_provider') {
    const profile = await ServiceProviderProfile.findOne({ user: userId });
    return profile ? { ownerType: 'service_provider', ownerProvider: profile._id } : null;
  }
  return null;
};

const buildItemPayload = (body) => {
  const { type, name, description, category, tags, pricingModel, price, priceRange, websiteUrl } = body;
  const itemData = { type, name, description, category, pricingModel, price, priceRange, websiteUrl };

    if (tags) {
      itemData.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
    }
  return itemData;
};

const attachOwner = async (itemData, userId, userType) => {
  if (userType === 'freelancer') {
    const profile = await FreelancerProfile.findOne({ user: userId });
    if (!profile) {
      throw new Error('Freelancer profile required');
    }
    itemData.ownerType = 'freelancer';
    itemData.ownerFreelancer = profile._id;
    return itemData;
  }
  if (userType === 'service_provider') {
    const profile = await ServiceProviderProfile.findOne({ user: userId });
    if (!profile) {
      throw new Error('Service provider profile required');
    }
    itemData.ownerType = 'service_provider';
    itemData.ownerProvider = profile._id;
    return itemData;
  }
  throw new Error('Unsupported owner type');
};

// Create marketplace item
router.post('/', auth, requireRole(['freelancer', 'service_provider']), async (req, res) => {
  try {
    const itemData = buildItemPayload(req.body);

    await attachOwner(itemData, req.userId, req.userType);

    const item = await MarketplaceItem.create(itemData);
    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error('Create marketplace item error:', error);
    res.status(500).json({ success: false, message: 'Error creating marketplace item' });
  }
});

// Get listings for current user
router.get('/my', auth, requireRole(['freelancer', 'service_provider']), async (req, res) => {
  try {
    const ownerFilter = await getOwnerFilter(req.userId, req.userType);
    if (!ownerFilter) {
      return res.status(400).json({ success: false, message: 'Profile required before listing services' });
    }

    const items = await MarketplaceItem.find(ownerFilter).sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (error) {
    console.error('Get my listings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching listings' });
  }
});

// Update listing
router.put('/:id', auth, requireRole(['freelancer', 'service_provider']), async (req, res) => {
  try {
    const ownerFilter = await getOwnerFilter(req.userId, req.userType);
    if (!ownerFilter) {
      return res.status(400).json({ success: false, message: 'Profile required' });
    }

    const updates = buildItemPayload(req.body);
    if (req.body.tags === null || req.body.tags === '') {
      updates.tags = [];
    }

    const item = await MarketplaceItem.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter },
      updates,
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Listing not found or not yours' });
    }

    res.json({ success: true, item });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({ success: false, message: 'Error updating listing' });
  }
});

// Delete listing
router.delete('/:id', auth, requireRole(['freelancer', 'service_provider']), async (req, res) => {
  try {
    const ownerFilter = await getOwnerFilter(req.userId, req.userType);
    if (!ownerFilter) {
      return res.status(400).json({ success: false, message: 'Profile required' });
    }

    const result = await MarketplaceItem.findOneAndDelete({ _id: req.params.id, ...ownerFilter });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Listing not found or not yours' });
    }

    res.json({ success: true, message: 'Listing removed' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ success: false, message: 'Error deleting listing' });
  }
});

module.exports = router;
