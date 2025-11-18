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
      firstName,
      lastName,
      expertiseTags,
      expertise,
      yearsExperience,
      pastProjects,
      portfolioLinks,
      hourlyRate,
      availability,
      experiences,
      education,
      resumeUrl
    } = req.body;

    // Validation
    if (!firstName || !expertise || !yearsExperience) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your first name, expertise, and years of experience'
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
    const expertiseArray = Array.isArray(expertiseTags)
      ? expertiseTags.map((tag) => String(tag).trim()).filter(Boolean)
      : expertise
      ? expertise.split(',').map(skill => skill.trim()).filter(Boolean)
      : [];

    const normalizedExperiences = Array.isArray(experiences)
      ? experiences
          .map((exp) => ({
            role: exp?.role || '',
            company: exp?.company || '',
            timeframe: exp?.timeframe || '',
            skillsUsed: exp?.skillsUsed || '',
            summary: exp?.summary || '',
          }))
          .filter((exp) => exp.role || exp.company)
      : [];

    const normalizedEducation = Array.isArray(education)
      ? education
          .map((item) => ({
            school: item?.school || '',
            degree: item?.degree || '',
            graduationYear: item?.graduationYear || '',
          }))
          .filter((item) => item.school)
      : [];

    const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();

    user.freelancerProfile = {
      firstName,
      lastName,
      name: displayName,
      expertise,
      expertiseTags: expertiseArray,
      yearsExperience,
      pastProjects: pastProjects || '',
      portfolioLinks: portfolioLinks || '',
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      availability: availability || 'not-available',
      bio: pastProjects || '',
      resumeUrl: resumeUrl || '',
      experiences: normalizedExperiences,
      education: normalizedEducation,
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
      headline: displayName,
      firstName,
      lastName,
      skills: expertiseArray,
      expertiseTags: expertiseArray,
      yearsExperience,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      availability: availability || 'not-available',
      industries: [],
      portfolioUrl: portfolioLinks || '',
      bio: pastProjects || '',
      resumeUrl: resumeUrl || '',
      experiences: normalizedExperiences,
      education: normalizedEducation,
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
      customIndustry,
      companySize,
      budgetRange,
      goals,
      requiredSkills,
      website,
      description,
      currentTools,
      challenges,
      preferredTimeline
    } = req.body;

    // Validation
    if (!businessName || !industry || !goals || !requiredSkills || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide business name, industry, goals, required skills, and description'
      });
    }
    if (industry === 'other' && !customIndustry) {
      return res.status(400).json({
        success: false,
        message: 'Please describe your industry when selecting other'
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
    const normalizedIndustry = industry === 'other' ? customIndustry : industry;

    const userBusinessProfile = {
      businessName,
      industry: normalizedIndustry,
      goals,
      requiredSkills: requiredSkills || '',
      website: website || '',
      description: description || '',
      budgetRange: budgetRange || '',
      currentTools: currentTools || '',
      challenges: challenges || '',
      preferredTimeline: preferredTimeline || '',
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
      industry: normalizedIndustry,
      goals,
      websiteUrl: website || '',
      description: description || '',
      budgetRange: budgetRange || '',
      currentTools: currentTools || '',
      challenges: challenges || '',
      preferredTimeline: preferredTimeline || '',
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
      headline,
      valueProposition,
      industryFocus,
      integrations,
      description,
      offerings,
      caseStudies,
      supportChannels,
      onboardingTime,
      pricingModel,
      teamSize,
      contactName,
      contactEmail,
      certifications,
      idealCustomerProfile,
      successMetrics,
      differentiators
    } = req.body;

    if (!companyName || !description || !valueProposition) {
      return res.status(400).json({
        success: false,
        message: 'Please provide company name, description, and your core value proposition'
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
    const parsedSupportChannels = Array.isArray(supportChannels)
      ? supportChannels.filter(Boolean)
      : (supportChannels ? supportChannels.split(',').map((item) => item.trim()).filter(Boolean) : []);
    const parsedCertifications = Array.isArray(certifications)
      ? certifications.filter(Boolean)
      : (certifications ? certifications.split(',').map((item) => item.trim()).filter(Boolean) : []);

    const normalizedOfferings = Array.isArray(offerings)
      ? offerings
          .map((offering) => ({
            name: offering?.name || '',
            promise: offering?.promise || '',
            priceRange: offering?.priceRange || '',
            timeline: offering?.timeline || '',
          }))
          .filter((offering) => offering.name)
      : [];

    const normalizedCaseStudies = Array.isArray(caseStudies)
      ? caseStudies
          .map((study) => ({
            client: study?.client || '',
            challenge: study?.challenge || '',
            solution: study?.solution || '',
            impact: study?.impact || '',
          }))
          .filter((study) => study.client || study.challenge)
      : [];

    user.serviceProviderProfile = {
      companyName,
      websiteUrl: websiteUrl || '',
      headline: headline || '',
      valueProposition,
      industryFocus: parsedIndustryFocus,
      integrations: parsedIntegrations,
      description,
      offerings: normalizedOfferings,
      caseStudies: normalizedCaseStudies,
      supportChannels: parsedSupportChannels,
      onboardingTime: onboardingTime || '',
      pricingModel: pricingModel || '',
      teamSize: teamSize || '',
      contactName: contactName || '',
      contactEmail: contactEmail || '',
      certifications: parsedCertifications,
      idealCustomerProfile: idealCustomerProfile || '',
      successMetrics: successMetrics || '',
      differentiators: differentiators || '',
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
        headline: headline || '',
        valueProposition,
        industryFocus: parsedIndustryFocus,
        integrations: parsedIntegrations,
        description,
        offerings: normalizedOfferings,
        caseStudies: normalizedCaseStudies,
        supportChannels: parsedSupportChannels,
        onboardingTime: onboardingTime || '',
        pricingModel: pricingModel || '',
        teamSize: teamSize || '',
        contactName: contactName || '',
        contactEmail: contactEmail || '',
        certifications: parsedCertifications,
        idealCustomerProfile: idealCustomerProfile || '',
        successMetrics: successMetrics || '',
        differentiators: differentiators || '',
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
