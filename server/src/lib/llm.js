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
const DEFAULT_TIMEOUT = 60000; // 60 seconds (increased for Ollama)

// Provider configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
console.log('🔧 OLLAMA_BASE_URL:', OLLAMA_BASE_URL);
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com';

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
    // Use appropriate model based on provider
    const selectedModel = LLM_PROVIDER === 'ollama'
      ? (process.env.OLLAMA_MODEL || 'llama3.2:3b')
      : model;

    const response = await callLLM({
      messages: apiMessages,
      model: selectedModel,
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
 * LLM API implementation - supports both Ollama (local) and OpenAI (remote)
 * This is where the actual API call happens
 */
function callLLM(options) {
  return new Promise((resolve, reject) => {
    const { messages, model, maxTokens, temperature, stream } = options;

    let payload;
    if (LLM_PROVIDER === 'ollama') {
      // Ollama /api/generate format - convert messages to prompt
      const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
      const userMessages = messages.filter(m => m.role === 'user');
      const prompt = systemPrompt
        ? `${systemPrompt}\n\n${userMessages.map(m => m.content).join('\n')}`
        : userMessages.map(m => m.content).join('\n');

      payload = JSON.stringify({
        model,
        prompt,
        stream: !!stream,
        options: {
          temperature,
          num_predict: maxTokens
        }
      });
    } else {
      // OpenAI format
      payload = JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: !!stream
      });
    }

    console.log(`🔧 Payload:`, JSON.stringify({model, messageCount: messages.length, max_tokens: maxTokens, stream: !!stream}));

    let requestOptions;

    if (LLM_PROVIDER === 'ollama') {
      // Ollama local API (HTTP, no auth required) - use /api/generate
      const url = new URL(`${OLLAMA_BASE_URL}/api/generate`);
      requestOptions = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: DEFAULT_TIMEOUT
      };
    } else {
      // OpenAI API (HTTPS, requires auth)
      requestOptions = {
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
    }

    const httpModule = LLM_PROVIDER === 'ollama' ? require('http') : https;

    console.log(`🔧 Making ${LLM_PROVIDER} request to:`, LLM_PROVIDER === 'ollama' ? OLLAMA_BASE_URL : OPENAI_BASE_URL);

    const req = httpModule.request(requestOptions, (res) => {
      let fullContent = '';
      const statusCode = res.statusCode || 500;

      if (statusCode >= 200 && statusCode < 300) {
        if (stream) {
          // Handle streaming response
          res.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim());

            for (const line of lines) {
              try {
                if (LLM_PROVIDER === 'ollama') {
                  // Ollama /api/generate response format
                  if (line.trim()) {
                    const parsed = JSON.parse(line);
                    if (parsed.done) {
                      stream({ type: 'done' });
                      break;
                    }
                    const delta = parsed.response;
                    if (delta) {
                      fullContent += delta;
                      stream({ type: 'delta', content: delta });
                    }
                  }
                } else {
                  // OpenAI response format
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6);

                    if (data === '[DONE]') {
                      stream({ type: 'done' });
                      break;
                    }

                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      fullContent += delta;
                      stream({ type: 'delta', content: delta });
                    }
                  }
                }
              } catch (e) {
                // Ignore parsing errors for SSE format
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
              let content = '';

              if (LLM_PROVIDER === 'ollama') {
                // Ollama response format
                content = data.response || '';
              } else {
                // OpenAI response format
                content = data.choices?.[0]?.message?.content || '';
              }

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
