const https = require('https');

const callOpenAI = (payload, apiKey = process.env.OPENAI_API_KEY) => {
  if (!apiKey) {
    return Promise.reject(new Error('Missing OPENAI_API_KEY'));
  }

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

module.exports = { callOpenAI };
