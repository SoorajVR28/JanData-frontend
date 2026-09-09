/**
 * Serverless Function Handler for Groq API (Vercel / Netlify / Node API route).
 * Keeps the GROQ_API_KEY safe on the server side and never exposes it to client browsers.
 */

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return res.status(500).json({
      error: 'GROQ_API_KEY environment variable is missing on serverless function env.',
    });
  }

  try {
    const { messages, model = 'llama-3.3-70b-versatile', temperature = 0.1, response_format } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid or missing "messages" array in request body.' });
    }

    const groqPayload = {
      model,
      messages,
      temperature,
    };

    if (response_format) {
      groqPayload.response_format = response_format;
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(groqPayload),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error('[Groq Serverless API Proxy Error]:', errText);
      return res.status(groqResponse.status).json({
        error: `Groq API Error (${groqResponse.status}): ${errText}`,
      });
    }

    const data = await groqResponse.json();
    const messageContent = data.choices?.[0]?.message?.content || '';

    return res.status(200).json({
      content: messageContent,
      usage: data.usage || null,
      model: data.model || model,
    });
  } catch (error) {
    console.error('[Groq Serverless Handler Exception]:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
