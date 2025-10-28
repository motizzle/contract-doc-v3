#!/usr/bin/env node
/**
 * Start server in AI demo mode for testing
 * Usage: node start-demo.js
 */

process.env.AI_DEMO_MODE = 'true';
console.log('🎭 Starting server in AI DEMO MODE');
console.log('   AI will return demo responses with jokes instead of using Ollama\n');

require('./src/server.js');

