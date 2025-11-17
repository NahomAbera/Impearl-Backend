const express = require('express');
const router = express.Router();
const User = require('../models/User');
const BusinessProfileModel = require('../models/BusinessProfile');
const FreelancerProfileModel = require('../models/FreelancerProfile');
const ServiceProviderProfileModel = require('../models/ServiceProviderProfile');
const auth = require('../middleware/auth');

// Get user profile
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
});

// Create/Update Freelancer Profile
router.post('/freelancer', auth, async (req, res) => {
  try {
    const {
      name,
      expertise,
      yearsExperience,
      pastProjects,
      portfolioLinks,
      hourlyRate,
      availability
    } = req.body;

    // Validation
    if (!name || !expertise || !yearsExperience) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, expertise, and years of experience'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.userType !== 'freelancer') {
      return res.status(403).json({
        success: false,
        message: 'Only freelancers can create a freelancer profile'
      });
    }

    // Update freelancer profile
    const parsedSkills = expertise
      ? expertise.split(',').map(skill => skill.trim()).filter(Boolean)
      : [];

    user.freelancerProfile = {
      name,
      expertise,
      yearsExperience,
      pastProjects: pastProjects || '',
      portfolioLinks: portfolioLinks || '',
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      availability: availability || 'not-available',
      bio: pastProjects || '',
      rating: user.freelancerProfile?.rating || 0,
      reviewCount: user.freelancerProfile?.reviewCount || 0,
      stripeAccountId: user.freelancerProfile?.stripeAccountId || null,
      stripeStatus: user.freelancerProfile?.stripeStatus || 'pending',
      payoutsEnabled: user.freelancerProfile?.payoutsEnabled || false
    };

    await user.save();

    const freelancerProfileDoc = {
      user: user._id,
      user_id: user._id,
      headline: name,
      skills: parsedSkills,
      yearsExperience,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      availability: availability || 'not-available',
      industries: [],
      portfolioUrl: portfolioLinks || '',
      bio: pastProjects || '',
      stripeAccountId: user.freelancerProfile?.stripeAccountId || null,
      stripeStatus: user.freelancerProfile?.stripeStatus || 'pending',
      payoutsEnabled: user.freelancerProfile?.payoutsEnabled || false,
      ratingAvg: user.freelancerProfile?.rating || 0,
      ratingCount: user.freelancerProfile?.reviewCount || 0,
    };

    await FreelancerProfileModel.findOneAndUpdate(
      { $or: [{ user: user._id }, { user_id: user._id }] },
      freelancerProfileDoc,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'Freelancer profile created successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Create freelancer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating freelancer profile',
      error: error.message
    });
  }
});

// Create/Update Business Profile
router.post('/business', auth, async (req, res) => {
  try {
    const {
      businessName,
      industry,
      companySize,
      goals,
      requiredSkills,
      website,
      description
    } = req.body;

    // Validation
    if (!businessName || !industry || !goals) {
      return res.status(400).json({
        success: false,
        message: 'Please provide business name, industry, and goals'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.userType !== 'business') {
      return res.status(403).json({
        success: false,
        message: 'Only businesses can create a business profile'
      });
    }

    // Update business profile
    const userBusinessProfile = {
      businessName,
      industry,
      goals,
      requiredSkills: requiredSkills || '',
      website: website || '',
      description: description || '',
      rating: user.businessProfile?.rating || 0,
      reviewCount: user.businessProfile?.reviewCount || 0
    };

    if (companySize) {
      userBusinessProfile.companySize = companySize;
    }

    user.businessProfile = userBusinessProfile;

    await user.save();

    const businessProfileDoc = {
      user: user._id,
      businessName,
      industry,
      goals,
      websiteUrl: website || '',
      description: description || '',
      ratingAvg: user.businessProfile?.rating || 0,
      ratingCount: user.businessProfile?.reviewCount || 0
    };

    if (companySize) {
      businessProfileDoc.companySize = companySize;
    }

    businessProfileDoc.user_id = user._id;

    await BusinessProfileModel.findOneAndUpdate(
      { $or: [{ user: user._id }, { user_id: user._id }] },
      businessProfileDoc,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'Business profile created successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Create business profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating business profile',
      error: error.message
    });
  }
});

// Create/Update Service Provider Profile
router.post('/service-provider', auth, async (req, res) => {
  try {
    const {
      companyName,
      websiteUrl,
      industryFocus,
      integrations,
      description
    } = req.body;

    if (!companyName || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide company name and description'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.userType !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Only service providers can create a service provider profile'
      });
    }

    const parsedIndustryFocus = Array.isArray(industryFocus)
      ? industryFocus
      : (industryFocus ? industryFocus.split(',').map(item => item.trim()).filter(Boolean) : []);
    const parsedIntegrations = Array.isArray(integrations)
      ? integrations
      : (integrations ? integrations.split(',').map(item => item.trim()).filter(Boolean) : []);

    user.serviceProviderProfile = {
      companyName,
      websiteUrl: websiteUrl || '',
      industryFocus: parsedIndustryFocus,
      integrations: parsedIntegrations,
      description,
      rating: user.serviceProviderProfile?.rating || 0,
      reviewCount: user.serviceProviderProfile?.reviewCount || 0,
      stripeAccountId: user.serviceProviderProfile?.stripeAccountId || null,
      stripeStatus: user.serviceProviderProfile?.stripeStatus || 'pending',
      payoutsEnabled: user.serviceProviderProfile?.payoutsEnabled || false
    };

    await user.save();

    await ServiceProviderProfileModel.findOneAndUpdate(
      { $or: [{ user: user._id }, { user_id: user._id }] },
      {
        user: user._id,
        user_id: user._id,
        companyName,
        websiteUrl: websiteUrl || '',
        industryFocus: parsedIndustryFocus,
        integrations: parsedIntegrations,
        description,
        stripeAccountId: user.serviceProviderProfile?.stripeAccountId || null,
        stripeStatus: user.serviceProviderProfile?.stripeStatus || 'pending',
        payoutsEnabled: user.serviceProviderProfile?.payoutsEnabled || false,
        ratingAvg: user.serviceProviderProfile?.rating || 0,
        ratingCount: user.serviceProviderProfile?.reviewCount || 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'Provider profile created successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Create service provider profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating service provider profile',
      error: error.message
    });
  }
});

// Get all freelancers (for search/browse)
router.get('/freelancers', auth, async (req, res) => {
  try {
    const freelancers = await User.find({ 
      userType: 'freelancer',
      'freelancerProfile.name': { $exists: true, $ne: '' },
      'freelancerProfile.payoutsEnabled': true
    }).select('-password');

    res.json({
      success: true,
      freelancers
    });
  } catch (error) {
    console.error('Get freelancers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching freelancers',
      error: error.message
    });
  }
});

// Get single freelancer by ID
router.get('/freelancer/:id', auth, async (req, res) => {
  try {
    const freelancer = await User.findOne({
      _id: req.params.id,
      userType: 'freelancer'
    }).select('-password');

    if (!freelancer) {
      return res.status(404).json({
        success: false,
        message: 'Freelancer not found'
      });
    }

    res.json({
      success: true,
      freelancer
    });
  } catch (error) {
    console.error('Get freelancer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching freelancer',
      error: error.message
    });
  }
});

// Get all service providers
router.get('/service-providers', auth, async (req, res) => {
  try {
    const providers = await User.find({
      userType: 'service_provider',
      'serviceProviderProfile.companyName': { $exists: true, $ne: '' },
      'serviceProviderProfile.payoutsEnabled': true
    }).select('-password');

    res.json({
      success: true,
      providers
    });
  } catch (error) {
    console.error('Get service providers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service providers',
      error: error.message
    });
  }
});

// Get single service provider
router.get('/service-provider/:id', auth, async (req, res) => {
  try {
    const provider = await User.findOne({
      _id: req.params.id,
      userType: 'service_provider'
    }).select('-password');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Service provider not found'
      });
    }

    res.json({
      success: true,
      provider
    });
  } catch (error) {
    console.error('Get service provider error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service provider',
      error: error.message
    });
  }
});

module.exports = router;
