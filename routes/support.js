const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const { getMatchesForUser, buildProfileSummary, formatMatchesForPrompt } = require('../utils/matching');
const { callOpenAI } = require('../utils/openai');

router.post('/chat', auth, async (req, res) => {
  try {
    const { messages = [], context = {} } = req.body;
    const user = await User.findById(req.userId);
    const profileSummary = buildProfileSummary(user);
    const matches = await getMatchesForUser(user);

    const personalizedContext = [];
    if (profileSummary) {
      personalizedContext.push(
        `User role: ${profileSummary.role}`,
        `Preferred name/company: ${profileSummary.name}`,
        profileSummary.focus ? `Focus: ${profileSummary.focus}` : null,
        profileSummary.goals ? `Goals: ${profileSummary.goals}` : null,
        profileSummary.requiredSkills ? `Needs: ${profileSummary.requiredSkills}` : null
      );
    }

    const matchSummary = formatMatchesForPrompt(matches);
    if (matchSummary) {
      personalizedContext.push(matchSummary);
    }

    if (context?.extras) {
      personalizedContext.push(`Additional context: ${context.extras}`);
    }

    const systemPrompt = `You are IMPEARL Support AI. Provide guidance only about how to use the IMPEARL platform.
Use the context below to personalize your tone and recommendations, greet the user by their provided name, and reference relevant matches when explaining next steps.
Context:\n${personalizedContext.filter(Boolean).join('\n')}`;

    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        success: true,
        reply: "I'm not connected to the support service right now, but you can reach IMPEARL support at support@impearl.com.",
      });
    }

    const data = await callOpenAI(
      {
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
        ],
      },
      process.env.OPENAI_API_KEY
    );
    res.json({ success: true, reply: data.choices?.[0]?.message?.content || '' });
  } catch (error) {
    console.error('Support chat error:', error);
    res.json({
      success: true,
      reply: "I'm having trouble reaching IMPEARL support right now. Please try again shortly or contact support@impearl.com.",
    });
  }
});

module.exports = router;
