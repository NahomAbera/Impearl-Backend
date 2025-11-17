const User = require('../models/User');

const tokenize = (text = '') =>
  text
    .toLowerCase()
    .split(/[^a-z0-9\+]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const buildTokenSet = (parts = []) => {
  const tokens = new Set();
  parts
    .filter(Boolean)
    .map((part) => tokenize(part))
    .flat()
    .forEach((token) => tokens.add(token));
  return tokens;
};

const scoreTokenSets = (needles, haystack) => {
  if (!needles.size || !haystack.size) return 0;
  let score = 0;
  haystack.forEach((token) => {
    if (needles.has(token)) {
      score += 1;
    }
  });
  return score;
};

const buildFreelancerSummary = (user) => ({
  id: user._id,
  name: user.freelancerProfile?.name || user.email,
  expertise: user.freelancerProfile?.expertise,
  yearsExperience: user.freelancerProfile?.yearsExperience,
  hourlyRate: user.freelancerProfile?.hourlyRate,
  availability: user.freelancerProfile?.availability,
  rating: user.freelancerProfile?.rating,
  reviewCount: user.freelancerProfile?.reviewCount,
});

const buildProviderSummary = (user) => ({
  id: user._id,
  companyName: user.serviceProviderProfile?.companyName || user.email,
  industryFocus: user.serviceProviderProfile?.industryFocus || [],
  integrations: user.serviceProviderProfile?.integrations || [],
  description: user.serviceProviderProfile?.description,
  rating: user.serviceProviderProfile?.rating,
  reviewCount: user.serviceProviderProfile?.reviewCount,
});

const buildBusinessSummary = (user) => ({
  id: user._id,
  businessName: user.businessProfile?.businessName || user.email,
  industry: user.businessProfile?.industry,
  goals: user.businessProfile?.goals,
  requiredSkills: user.businessProfile?.requiredSkills,
  companySize: user.businessProfile?.companySize,
  website: user.businessProfile?.website,
});

const getCandidateFreelancers = async () =>
  User.find({
    userType: 'freelancer',
    'freelancerProfile.name': { $exists: true, $ne: '' },
    'freelancerProfile.payoutsEnabled': true,
  })
    .select('freelancerProfile userType email')
    .lean();

const getCandidateProviders = async () =>
  User.find({
    userType: 'service_provider',
    'serviceProviderProfile.companyName': { $exists: true, $ne: '' },
    'serviceProviderProfile.payoutsEnabled': true,
  })
    .select('serviceProviderProfile userType email')
    .lean();

const getCandidateBusinesses = async () =>
  User.find({
    userType: 'business',
    'businessProfile.businessName': { $exists: true, $ne: '' },
  })
    .select('businessProfile userType email')
    .lean();

const sortAndTrim = (items = [], limit = 3) =>
  items
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

const scoreFreelancerForBusiness = (businessProfile, freelancerProfile) => {
  const businessTokens = buildTokenSet([
    businessProfile?.requiredSkills,
    businessProfile?.goals,
    businessProfile?.description,
    businessProfile?.industry,
  ]);
  const freelancerTokens = buildTokenSet([
    freelancerProfile?.expertise,
    freelancerProfile?.pastProjects,
  ]);

  let score = scoreTokenSets(businessTokens, freelancerTokens);
  if (freelancerProfile?.yearsExperience?.includes('5')) score += 0.5;
  if (freelancerProfile?.yearsExperience === '10+') score += 1;
  return score;
};

const scoreProviderForBusiness = (businessProfile, providerProfile) => {
  const businessTokens = buildTokenSet([
    businessProfile?.industry,
    businessProfile?.goals,
    businessProfile?.description,
  ]);
  const providerTokens = buildTokenSet([
    (providerProfile?.industryFocus || []).join(' '),
    (providerProfile?.integrations || []).join(' '),
    providerProfile?.description,
  ]);
  return scoreTokenSets(businessTokens, providerTokens);
};

const scoreBusinessForTalent = (businessProfile, talentTokens) => {
  const businessTokens = buildTokenSet([
    businessProfile?.requiredSkills,
    businessProfile?.goals,
    businessProfile?.description,
    businessProfile?.industry,
  ]);
  return scoreTokenSets(businessTokens, talentTokens);
};

const getMatchesForUser = async (user) => {
  if (!user) {
    return { freelancers: [], providers: [], businesses: [] };
  }

  if (user.userType === 'business') {
    const matches = { freelancers: [], providers: [] };
    const businessProfile = user.businessProfile || {};

    const [freelancers, providers] = await Promise.all([
      getCandidateFreelancers(),
      getCandidateProviders(),
    ]);

    matches.freelancers = sortAndTrim(
      freelancers.map((freelancer) => ({
        ...buildFreelancerSummary(freelancer),
        score: scoreFreelancerForBusiness(businessProfile, freelancer.freelancerProfile || {}),
      }))
    );

    matches.providers = sortAndTrim(
      providers.map((provider) => ({
        ...buildProviderSummary(provider),
        score: scoreProviderForBusiness(businessProfile, provider.serviceProviderProfile || {}),
      }))
    );

    return matches;
  }

  const talentProfile =
    user.userType === 'freelancer'
      ? user.freelancerProfile || {}
      : user.serviceProviderProfile || {};
  const talentTokens =
    user.userType === 'freelancer'
      ? buildTokenSet([
          talentProfile.expertise,
          talentProfile.pastProjects,
        ])
      : buildTokenSet([
          (talentProfile.industryFocus || []).join(' '),
          (talentProfile.integrations || []).join(' '),
          talentProfile.description,
        ]);

  const businesses = await getCandidateBusinesses();

  const rankedBusinesses = sortAndTrim(
    businesses.map((business) => ({
      ...buildBusinessSummary(business),
      score: scoreBusinessForTalent(business.businessProfile || {}, talentTokens),
    }))
  );

  return { businesses: rankedBusinesses };
};

const buildProfileSummary = (user) => {
  if (!user) return null;
  const summary = {
    role: user.userType,
    name:
      user.userType === 'business'
        ? user.businessProfile?.businessName || user.email
        : user.userType === 'freelancer'
        ? user.freelancerProfile?.name || user.email
        : user.serviceProviderProfile?.companyName || user.email,
    focus:
      user.userType === 'business'
        ? user.businessProfile?.industry
        : user.userType === 'freelancer'
        ? user.freelancerProfile?.expertise
        : (user.serviceProviderProfile?.industryFocus || []).join(', '),
    goals:
      user.userType === 'business'
        ? user.businessProfile?.goals
        : user.userType === 'freelancer'
        ? user.freelancerProfile?.pastProjects
        : user.serviceProviderProfile?.description,
  };
  if (user.userType === 'business') {
    summary.requiredSkills = user.businessProfile?.requiredSkills;
  }
  return summary;
};

const formatMatchesForPrompt = (matches = {}) => {
  const lines = [];
  if (matches.freelancers?.length) {
    lines.push(
      'Top freelance matches:' +
        matches.freelancers
          .map((match) => `${match.name} (${match.expertise || 'expert'}) score:${match.score.toFixed(1)}`)
          .join('; ')
    );
  }
  if (matches.providers?.length) {
    lines.push(
      'Top service providers:' +
        matches.providers
          .map((match) => `${match.companyName} (${(match.industryFocus || []).join('/') || 'general'}) score:${match.score.toFixed(1)}`)
          .join('; ')
    );
  }
  if (matches.businesses?.length) {
    lines.push(
      'Top business prospects:' +
        matches.businesses
          .map((biz) => `${biz.businessName} (${biz.industry || 'industry agnostic'}) score:${biz.score.toFixed(1)}`)
          .join('; ')
    );
  }
  return lines.join('\n');
};

module.exports = {
  getMatchesForUser,
  buildProfileSummary,
  formatMatchesForPrompt,
  buildFreelancerSummary,
  buildProviderSummary,
  buildBusinessSummary,
};
