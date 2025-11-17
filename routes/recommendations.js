const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const User = require('../models/User');
const BusinessProfile = require('../models/BusinessProfile');
const QnASession = require('../models/QnASession');
const { callOpenAI } = require('../utils/openai');
const {
  getMatchesForUser,
  buildFreelancerSummary,
  buildProviderSummary,
  buildBusinessSummary,
} = require('../utils/matching');

const fetchCandidates = async (type, limit = 8) => {
  const queryMap = {
    freelancer: {
      filter: { userType: 'freelancer', 'freelancerProfile.name': { $exists: true, $ne: '' }, 'freelancerProfile.payoutsEnabled': true },
      select: 'freelancerProfile email userType',
      map: buildFreelancerSummary,
    },
    provider: {
      filter: { userType: 'service_provider', 'serviceProviderProfile.companyName': { $exists: true, $ne: '' }, 'serviceProviderProfile.payoutsEnabled': true },
      select: 'serviceProviderProfile email userType',
      map: buildProviderSummary,
    },
    business: {
      filter: { userType: 'business', 'businessProfile.businessName': { $exists: true, $ne: '' } },
      select: 'businessProfile email userType',
      map: buildBusinessSummary,
    },
  };

  const config = queryMap[type];
  if (!config) return [];
  const users = await User.find(config.filter).select(config.select).limit(limit).lean();
  return users.map(config.map);
};

const parseRecommendations = (text) => {
  try {
    const json = JSON.parse(text);
    return Array.isArray(json.recommendations) ? json.recommendations : [];
  } catch (error) {
    return [];
  }
};

const rankCandidates = async ({ systemPrompt, payload }) => {
  try {
    const response = await callOpenAI({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      temperature: 0.2,
    });
    const content = response.choices?.[0]?.message?.content || '';
    return parseRecommendations(content);
  } catch (error) {
    console.error('OpenAI recommendation error:', error.message);
    return [];
  }
};

const enrichWithDetails = (recommendations, candidates) => {
  const map = candidates.reduce((acc, candidate) => {
    acc[candidate.id.toString()] = candidate;
    return acc;
  }, {});

  return recommendations
    .map((rec) => {
      const details = map[rec.id] || {};
      return {
        ...details,
        id: rec.id,
        score: rec.score,
        reason: rec.reason,
      };
    })
    .filter((item) => item.id);
};

const fallbackFromMatches = async (user, key) => {
  const matches = await getMatchesForUser(user);
  return matches[key] || [];
};

router.get('/freelancers', auth, requireRole('business'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.userType !== 'business' || !user.businessProfile?.businessName) {
      return res.status(400).json({ success: false, message: 'Business profile required' });
    }

    const businessProfile = user.businessProfile;
    const profileDoc = await BusinessProfile.findOne({ user: req.userId });
    const qna = profileDoc
      ? await QnASession.findOne({ business: profileDoc._id }).sort({ createdAt: -1 })
      : null;

    const candidates = await fetchCandidates('freelancer');
    if (!candidates.length) {
      return res.json({ success: true, recommendations: [], fallback: false });
    }
    const aiRecommendations = await rankCandidates({
      systemPrompt: 'You are an AI matchmaker for IMPEARL. Given a business profile and candidate freelancers, respond with JSON {"recommendations": [{"id": "...", "score": number, "reason": "..."}]} sorted by best fit. Consider goals, skills, experience, and availability.',
      payload: {
        business: businessProfile,
        intakeAnswers: qna?.answers || {},
        candidates,
      },
    });

    let recommendations = enrichWithDetails(aiRecommendations, candidates);
    let fallback = false;

    if (!recommendations.length) {
      recommendations = await fallbackFromMatches(user, 'freelancers');
      fallback = true;
    }

    res.json({ success: true, recommendations, fallback });
  } catch (error) {
    console.error('Freelancer recommendation error:', error);
    res.status(500).json({ success: false, message: 'Error generating freelancer recommendations' });
  }
});

router.get('/providers', auth, requireRole('business'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.userType !== 'business' || !user.businessProfile?.businessName) {
      return res.status(400).json({ success: false, message: 'Business profile required' });
    }

    const candidates = await fetchCandidates('provider');
    if (!candidates.length) {
      return res.json({ success: true, recommendations: [], fallback: false });
    }
    const profileDoc = await BusinessProfile.findOne({ user: req.userId });
    const qna = profileDoc
      ? await QnASession.findOne({ business: profileDoc._id }).sort({ createdAt: -1 })
      : null;

    const aiRecommendations = await rankCandidates({
      systemPrompt: 'You are an AI advisor for IMPEARL. Rank service providers for a business. Respond with JSON {"recommendations":[{"id":"...","score":number,"reason":"..."}]} ordered by best fit. Consider industry focus, integrations, and business goals.',
      payload: {
        business: user.businessProfile,
        intakeAnswers: qna?.answers || {},
        candidates,
      },
    });

    let recommendations = enrichWithDetails(aiRecommendations, candidates);
    let fallback = false;

    if (!recommendations.length) {
      recommendations = await fallbackFromMatches(user, 'providers');
      fallback = true;
    }

    res.json({ success: true, recommendations, fallback });
  } catch (error) {
    console.error('Provider recommendation error:', error);
    res.status(500).json({ success: false, message: 'Error generating provider recommendations' });
  }
});

router.get('/businesses', auth, requireRole(['freelancer', 'service_provider']), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const candidates = await fetchCandidates('business');
    if (!candidates.length) {
      return res.json({ success: true, recommendations: [], fallback: false });
    }

    const profileSummary = user.userType === 'freelancer'
      ? user.freelancerProfile
      : user.serviceProviderProfile;

    const aiRecommendations = await rankCandidates({
      systemPrompt: 'You connect IMPEARL talent with businesses. Respond with JSON {"recommendations":[{"id":"...","score":number,"reason":"..."}]} ranked by collaboration fit. Consider business goals, required skills, and the talent profile.',
      payload: {
        talentRole: user.userType,
        talentProfile: profileSummary,
        candidates,
      },
    });

    let recommendations = enrichWithDetails(aiRecommendations, candidates);
    let fallback = false;

    if (!recommendations.length) {
      recommendations = await fallbackFromMatches(user, 'businesses');
      fallback = true;
    }

    res.json({ success: true, recommendations, fallback });
  } catch (error) {
    console.error('Business recommendation error:', error);
    res.status(500).json({ success: false, message: 'Error generating business recommendations' });
  }
});

module.exports = router;
