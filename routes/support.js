const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.post('/chat', auth, async (req, res) => {
  try {
    const { messages = [] } = req.body;
    const systemPrompt = `You are IMPEARL Support AI. Provide guidance only about how to use the IMPEARL platform. If asked unrelated questions, politely redirect the user.`;

    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        success: true,
        reply: "I'm not connected to the support service right now, but you can reach IMPEARL support at support@impearl.com.",
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    const data = await response.json();
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
