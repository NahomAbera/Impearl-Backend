const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const https = require('https');

const callOpenAI = (payload, apiKey) => {
  return new Promise((resolve, reject) => {
    const req = https.request(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(data || `OpenAI error ${res.statusCode}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
};

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
