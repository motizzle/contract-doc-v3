#!/usr/bin/env node

/**
 * Build script to generate production manifest from development manifest
 * Replaces ALL localhost URLs with production BASE_URL
 * 
 * Handles:
 * - localhost:4000 (add-in dev server)
 * - localhost:4001 (main server API)
 * - localhost:4002 (superdoc)
 * - localhost:11434 (ollama - typically not in manifest, but just in case)
 */

const fs = require('fs');
const path = require('path');

// Get BASE_URL from environment or use default placeholder
const BASE_URL = process.env.BASE_URL || 'YOUR-APP-NAME.onrender.com';

// Ensure we have a proper URL (add https:// if missing)
const productionUrl = BASE_URL.startsWith('http') 
  ? BASE_URL 
  : `https://${BASE_URL}`;

console.log('🔨 Building production manifest...');
console.log(`📍 Production URL: ${productionUrl}`);

// Read the development manifest
const manifestPath = path.join(__dirname, 'manifest.xml');
const manifest = fs.readFileSync(manifestPath, 'utf8');

// Replace ALL localhost URLs with production URL
// The add-in uses port 4000, server uses 4001, superdoc uses 4002
const prodManifest = manifest
  .replace(/https:\/\/localhost:4000/g, productionUrl)
  .replace(/http:\/\/localhost:4000/g, productionUrl)
  .replace(/https:\/\/localhost:4001/g, productionUrl)
  .replace(/http:\/\/localhost:4001/g, productionUrl)
  .replace(/https:\/\/localhost:4002/g, productionUrl)
  .replace(/http:\/\/localhost:4002/g, productionUrl)
  .replace(/https:\/\/localhost:11434/g, productionUrl)
  .replace(/http:\/\/localhost:11434/g, productionUrl)
  .replace(/localhost:4000/g, BASE_URL.replace(/^https?:\/\//, ''))
  .replace(/localhost:4001/g, BASE_URL.replace(/^https?:\/\//, ''))
  .replace(/localhost:4002/g, BASE_URL.replace(/^https?:\/\//, ''))
  .replace(/localhost:11434/g, BASE_URL.replace(/^https?:\/\//, ''));

// Write production manifest
const outputPath = path.join(__dirname, 'manifest.production.xml');
fs.writeFileSync(outputPath, prodManifest, 'utf8');

console.log('✅ Production manifest generated successfully!');
console.log(`📝 Output: ${outputPath}`);
console.log('');
console.log('Next steps:');
console.log('1. Review the generated manifest.production.xml');
console.log('2. Copy to server/public/manifest.xml for deployment');
console.log('3. Users can download from: ' + productionUrl + '/manifest.xml');

