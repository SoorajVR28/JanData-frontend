import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Vite custom plugin to handle local serverless /api/groq endpoint during dev
function groqDevPlugin() {
  return {
    name: 'groq-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/groq', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.statusCode = 200;
          return res.end();
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }

        const env = loadEnv(server.config.mode, process.cwd(), '');
        const apiKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY;

        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(
            JSON.stringify({
              error: 'GROQ_API_KEY is not set in environment or .env file.',
            })
          );
        }

        let bodyStr = '';
        req.on('data', (chunk) => {
          bodyStr += chunk;
        });

        req.on('end', async () => {
          try {
            const payload = JSON.parse(bodyStr || '{}');

            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });

            const data = await groqRes.json();
            res.statusCode = groqRes.status;
            res.setHeader('Content-Type', 'application/json');
            
            if (!groqRes.ok) {
              return res.end(JSON.stringify({ error: data.error?.message || 'Groq API Error' }));
            }

            const content = data.choices?.[0]?.message?.content || '';
            res.end(JSON.stringify({ content, usage: data.usage }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), groqDevPlugin()],
})

