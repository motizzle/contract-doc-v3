/**
 * Server Startup Checks - Pre-flight validation
 * Ensures system is ready before accepting requests
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Check Node.js version
 */
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  
  if (major < 18) {
    return {
      pass: false,
      message: `Node.js ${major} detected. Requires Node.js 18+`,
      resolution: 'Upgrade Node.js to version 18 or higher'
    };
  }
  
  return { pass: true, message: `Node.js ${version}` };
}

/**
 * Check required dependencies
 */
function checkDependencies() {
  const required = [
    'express',
    'compression',
    'multer',
    'jsonwebtoken',
    'pdf-lib'
  ];
  
  const missing = [];
  
  for (const dep of required) {
    try {
      require.resolve(dep);
    } catch (err) {
      missing.push(dep);
    }
  }
  
  if (missing.length > 0) {
    return {
      pass: false,
      message: `Missing dependencies: ${missing.join(', ')}`,
      resolution: 'Run: npm install'
    };
  }
  
  return { pass: true, message: 'All required dependencies installed' };
}

/**
 * Check and create data directories
 */
function checkDataDirectories(rootDir) {
  const requiredDirs = [
    'data',
    'data/app',
    'data/app/documents',
    'data/app/exhibits',
    'data/working',
    'data/backups'
  ];
  
  const errors = [];
  
  for (const dir of requiredDirs) {
    const fullPath = path.join(rootDir, dir);
    try {
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      
      // Test write permission
      const testFile = path.join(fullPath, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (err) {
      errors.push(`${dir}: ${err.message}`);
    }
  }
  
  if (errors.length > 0) {
    return {
      pass: false,
      message: `Directory errors: ${errors.join(', ')}`,
      resolution: 'Check filesystem permissions and ensure data directories are writable'
    };
  }
  
  return { pass: true, message: `Data directories accessible` };
}

/**
 * Check available disk space
 */
function checkDiskSpace(rootDir) {
  try {
    // Check if we have at least 1GB available
    const stats = fs.statfsSync ? fs.statfsSync(rootDir) : null;
    
    if (stats) {
      const availableBytes = stats.bavail * stats.bsize;
      const availableGB = availableBytes / (1024 * 1024 * 1024);
      
      if (availableGB < 1) {
        return {
          pass: false,
          message: `Only ${availableGB.toFixed(2)}GB available`,
          resolution: 'Free up disk space (need at least 1GB)'
        };
      }
      
      return { pass: true, message: `${availableGB.toFixed(2)}GB available` };
    }
    
    // statfsSync not available on all platforms, skip check
    return { pass: true, message: 'Disk space check skipped (not available on this platform)' };
  } catch (err) {
    // Non-critical, allow server to start
    return { pass: true, message: `Disk space check skipped: ${err.message}` };
  }
}

/**
 * Check environment variables
 */
function checkEnvironment() {
  const warnings = [];
  
  // Check JWT secret in production
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'dev-secret-change-in-production-min-32-chars') {
      warnings.push('JWT_SECRET not set or using default (security risk)');
    } else if (jwtSecret.length < 32) {
      warnings.push('JWT_SECRET too short (should be at least 32 characters)');
    }
  }
  
  if (warnings.length > 0) {
    return {
      pass: true, // Warning, not critical
      message: `Warnings: ${warnings.join(', ')}`,
      resolution: 'Set secure JWT_SECRET in environment'
    };
  }
  
  return { pass: true, message: 'Environment variables OK' };
}

/**
 * Check memory availability
 */
function checkMemory() {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const freePercent = (freeMem / totalMem) * 100;
  const freeGB = freeMem / (1024 * 1024 * 1024);
  
  // Check absolute memory, not percentage (more reliable)
  // Node.js typically needs ~500MB to run comfortably
  if (freeGB < 0.5) {
    return {
      pass: false,
      message: `Only ${freeGB.toFixed(2)}GB memory available`,
      resolution: 'Free up system memory or increase available RAM'
    };
  }
  
  return { pass: true, message: `${freePercent.toFixed(1)}% memory available` };
}

/**
 * Run all startup checks
 */
function runStartupChecks(rootDir) {
  // Skip startup checks in test mode
  const isTestMode = process.env.NODE_ENV === 'test';
  
  if (isTestMode) {
    console.log('🧪 Test mode detected - skipping startup checks');
    return;
  }
  
  console.log('');
  console.log('🔍 Running startup checks...');
  console.log('');
  
  const checks = [
    { name: 'Node.js Version', fn: () => checkNodeVersion() },
    { name: 'Dependencies', fn: () => checkDependencies() },
    { name: 'Data Directories', fn: () => checkDataDirectories(rootDir) },
    { name: 'Disk Space', fn: () => checkDiskSpace(rootDir) },
    { name: 'Environment', fn: () => checkEnvironment() },
    { name: 'Memory', fn: () => checkMemory() }
  ];
  
  let allPassed = true;
  const failures = [];
  
  for (const check of checks) {
    const result = check.fn();
    
    if (result.pass) {
      console.log(`✅ ${check.name}: ${result.message}`);
    } else {
      console.error(`❌ ${check.name}: ${result.message}`);
      if (result.resolution) {
        console.error(`   Resolution: ${result.resolution}`);
      }
      failures.push({ name: check.name, ...result });
      allPassed = false;
    }
  }
  
  console.log('');
  
  if (!allPassed) {
    console.error('❌ Startup checks failed. Server cannot start.');
    console.error('');
    console.error('Failed checks:');
    for (const failure of failures) {
      console.error(`  - ${failure.name}: ${failure.message}`);
      if (failure.resolution) {
        console.error(`    → ${failure.resolution}`);
      }
    }
    console.error('');
    process.exit(1);
  }
  
  console.log('✅ All startup checks passed');
  console.log('');
}

module.exports = { runStartupChecks };

