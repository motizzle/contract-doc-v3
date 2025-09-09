/**
 * LLM Provider Abstraction Layer
 *
 * This module provides a unified interface for LLM providers,
 * supporting streaming responses and multiple provider backends.
 *
 * Architecture Rationale:
 * - Single interface for all LLM operations
 * - Provider-agnostic design allows easy switching
 * - Streaming support for real-time responses
 * - Error handling and fallbacks built-in
 */

const https = require('https');

// Configuration constants (can be moved to env later)
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
const DEFAULT_MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS || '500');
const DEFAULT_TEMPERATURE = Number(process.env.LLM_TEMPERATURE || '0.7');
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Main LLM generation function
 *
 * @param {Object} options - Generation options
 * @param {Array} options.messages - Chat messages array
 * @param {string} options.systemPrompt - System prompt
 * @param {Function} options.stream - Optional streaming callback
 * @param {string} options.model - Model to use
 * @param {number} options.maxTokens - Max tokens to generate
 * @param {number} options.temperature - Generation temperature
 * @returns {Promise<Object>} Response with content and metadata
 */
async function generateReply(options = {}) {
  const {
    messages = [],
    systemPrompt = '',
    stream = null,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE
  } = options;

  // Validate inputs
  if (!messages.length && !systemPrompt) {
    return { ok: false, error: 'No messages or system prompt provided' };
  }

  // Prepare messages for API
  const apiMessages = [];

  // Add system prompt if provided
  if (systemPrompt.trim()) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }

  // Add user messages
  apiMessages.push(...messages);

  try {
    const response = await callOpenAI({
      messages: apiMessages,
      model,
      maxTokens,
      temperature,
      stream
    });

    return response;
  } catch (error) {
    console.error('LLM generation error:', error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * OpenAI API implementation
 * This is where the actual API call happens
 */
function callOpenAI(options) {
  return new Promise((resolve, reject) => {
    const { messages, model, maxTokens, temperature, stream } = options;

    const payload = JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: !!stream // Enable streaming if callback provided
    });

    const requestOptions = {
      method: 'POST',
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: DEFAULT_TIMEOUT
    };

    const req = https.request(requestOptions, (res) => {
      let fullContent = '';
      const statusCode = res.statusCode || 500;

      if (statusCode >= 200 && statusCode < 300) {
        if (stream) {
          // Handle streaming response
          res.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim());

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);

                if (data === '[DONE]') {
                  stream({ type: 'done' });
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    fullContent += delta;
                    stream({ type: 'delta', content: delta });
                  }
                } catch (e) {
                  // Ignore parsing errors for SSE format
                }
              }
            }
          });

          res.on('end', () => {
            stream({ type: 'complete', fullContent });
            resolve({ ok: true, content: fullContent });
          });
        } else {
          // Handle non-streaming response
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));

          res.on('end', () => {
            const body = Buffer.concat(chunks).toString();
            try {
              const data = JSON.parse(body);
              const content = data.choices?.[0]?.message?.content || '';
              resolve({ ok: true, content });
            } catch (error) {
              resolve({ ok: false, error: 'Failed to parse response' });
            }
          });
        }
      } else {
        resolve({ ok: false, error: `API error: ${statusCode}` });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Request timeout' });
    });

    req.on('error', (error) => {
      resolve({ ok: false, error: error.message });
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  generateReply
};
