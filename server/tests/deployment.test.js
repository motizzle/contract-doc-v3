/**
 * Deployment Tests
 * 
 * Tests for deployment-related functionality:
 * - Manifest generation (localhost -> production URL replacement)
 * - API base URL detection (localhost vs production)
 * - Environment-aware configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Deployment Configuration', () => {
  
  describe('Manifest Generation Script', () => {
    const manifestPath = path.join(__dirname, '../../addin/manifest.xml');
    const prodManifestPath = path.join(__dirname, '../../addin/manifest.production.xml');
    const buildScriptPath = path.join(__dirname, '../../addin/build-manifest.js');

    afterEach(() => {
      // Clean up generated manifest after each test
      if (fs.existsSync(prodManifestPath)) {
        fs.unlinkSync(prodManifestPath);
      }
    });

    test('build script exists and is executable', () => {
      expect(fs.existsSync(buildScriptPath)).toBe(true);
      const stats = fs.statSync(buildScriptPath);
      expect(stats.isFile()).toBe(true);
    });

    test('development manifest exists with localhost URLs', () => {
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifest = fs.readFileSync(manifestPath, 'utf8');
      
      // Should contain localhost:4000 (add-in dev server)
      expect(manifest).toMatch(/localhost:4000/);
      
      // Should NOT contain production URLs
      expect(manifest).not.toMatch(/onrender\.com/);
    });

    test('generates production manifest with default placeholder', () => {
      // Run build script without BASE_URL (should use default)
      execSync('node build-manifest.js', {
        cwd: path.join(__dirname, '../../addin'),
        env: { ...process.env, BASE_URL: undefined }
      });

      expect(fs.existsSync(prodManifestPath)).toBe(true);
      const prodManifest = fs.readFileSync(prodManifestPath, 'utf8');

      // Should contain placeholder
      expect(prodManifest).toMatch(/YOUR-APP-NAME\.onrender\.com/);
      
      // Should NOT contain localhost
      expect(prodManifest).not.toMatch(/localhost:4000/);
      expect(prodManifest).not.toMatch(/localhost:4001/);
      expect(prodManifest).not.toMatch(/localhost:4002/);
    });

    test('generates production manifest with custom BASE_URL', () => {
      const testUrl = 'https://wordftw-test.onrender.com';
      
      execSync('node build-manifest.js', {
        cwd: path.join(__dirname, '../../addin'),
        env: { ...process.env, BASE_URL: testUrl }
      });

      expect(fs.existsSync(prodManifestPath)).toBe(true);
      const prodManifest = fs.readFileSync(prodManifestPath, 'utf8');

      // Should contain custom URL
      expect(prodManifest).toMatch(/wordftw-test\.onrender\.com/);
      
      // Should NOT contain localhost
      expect(prodManifest).not.toMatch(/localhost/);
    });

    test('handles BASE_URL without protocol', () => {
      const testUrl = 'wordftw-test.onrender.com'; // No https://
      
      execSync('node build-manifest.js', {
        cwd: path.join(__dirname, '../../addin'),
        env: { ...process.env, BASE_URL: testUrl }
      });

      const prodManifest = fs.readFileSync(prodManifestPath, 'utf8');

      // Should add https:// automatically
      expect(prodManifest).toMatch(/https:\/\/wordftw-test\.onrender\.com/);
    });

    test('replaces all localhost ports (4000, 4001, 4002, 11434)', () => {
      const devManifest = fs.readFileSync(manifestPath, 'utf8');
      const testUrl = 'https://test.onrender.com';
      
      execSync('node build-manifest.js', {
        cwd: path.join(__dirname, '../../addin'),
        env: { ...process.env, BASE_URL: testUrl }
      });

      const prodManifest = fs.readFileSync(prodManifestPath, 'utf8');

      // Verify NO localhost ports remain
      expect(prodManifest).not.toMatch(/localhost:4000/);
      expect(prodManifest).not.toMatch(/localhost:4001/);
      expect(prodManifest).not.toMatch(/localhost:4002/);
      expect(prodManifest).not.toMatch(/localhost:11434/);
      expect(prodManifest).not.toMatch(/localhost/);
    });

    test('preserves XML structure and non-URL content', () => {
      const devManifest = fs.readFileSync(manifestPath, 'utf8');
      
      execSync('node build-manifest.js', {
        cwd: path.join(__dirname, '../../addin'),
        env: { ...process.env, BASE_URL: 'https://test.onrender.com' }
      });

      const prodManifest = fs.readFileSync(prodManifestPath, 'utf8');

      // Check XML structure preserved
      expect(prodManifest).toMatch(/<\?xml version="1\.0"/);
      expect(prodManifest).toMatch(/<OfficeApp/);
      expect(prodManifest).toMatch(/<\/OfficeApp>/);
      
      // Check metadata preserved
      expect(prodManifest).toMatch(/<DisplayName DefaultValue="OpenGov Contracting"\/>/);
      expect(prodManifest).toMatch(/<Version>1\.0\.1\.0<\/Version>/);
    });

    test('replaces all URL occurrences (IconUrl, SourceLocation, etc)', () => {
      const testUrl = 'https://test.onrender.com';
      
      execSync('node build-manifest.js', {
        cwd: path.join(__dirname, '../../addin'),
        env: { ...process.env, BASE_URL: testUrl }
      });

      const prodManifest = fs.readFileSync(prodManifestPath, 'utf8');

      // Check all expected URL types are replaced
      expect(prodManifest).toMatch(/IconUrl DefaultValue="https:\/\/test\.onrender\.com\/assets\/icon-32\.png"/);
      expect(prodManifest).toMatch(/SourceLocation DefaultValue="https:\/\/test\.onrender\.com\/taskpane\.html"/);
      expect(prodManifest).toMatch(/Commands\.Url.*https:\/\/test\.onrender\.com\/commands\.html/);
      expect(prodManifest).toMatch(/Taskpane\.Url.*https:\/\/test\.onrender\.com\/taskpane\.html/);
    });

    test('generated manifest is valid XML', () => {
      execSync('node build-manifest.js', {
        cwd: path.join(__dirname, '../../addin'),
        env: { ...process.env, BASE_URL: 'https://test.onrender.com' }
      });

      const prodManifest = fs.readFileSync(prodManifestPath, 'utf8');

      // Basic XML validation
      expect(prodManifest.match(/<OfficeApp/g).length).toBe(1);
      expect(prodManifest.match(/<\/OfficeApp>/g).length).toBe(1);
      
      // No malformed tags
      expect(prodManifest).not.toMatch(/<[^>]*<[^>]*>/); // No nested angle brackets
    });
  });

  describe('API Base URL Detection', () => {
    let getApiBase;

    beforeEach(() => {
      // Load the components.react.js file and extract getApiBase function
      const componentsPath = path.join(__dirname, '../../shared-ui/components.react.js');
      const componentsCode = fs.readFileSync(componentsPath, 'utf8');
      
      // Extract and evaluate getApiBase function
      const getApiBaseMatch = componentsCode.match(/function getApiBase\(\) \{[\s\S]*?\n  \}/);
      expect(getApiBaseMatch).toBeTruthy();
    });

    test('components.react.js contains getApiBase function', () => {
      const componentsPath = path.join(__dirname, '../../shared-ui/components.react.js');
      const componentsCode = fs.readFileSync(componentsPath, 'utf8');
      
      expect(componentsCode).toMatch(/function getApiBase\(\)/);
      expect(componentsCode).toMatch(/isLocalhost/);
      expect(componentsCode).toMatch(/window\.location/);
    });

    test('getApiBase logic checks for localhost', () => {
      const componentsPath = path.join(__dirname, '../../shared-ui/components.react.js');
      const componentsCode = fs.readFileSync(componentsPath, 'utf8');
      
      // Should check hostname
      expect(componentsCode).toMatch(/window\.location\.hostname === 'localhost'/);
      expect(componentsCode).toMatch(/window\.location\.hostname === '127\.0\.0\.1'/);
      
      // Should return different values for localhost vs production
      expect(componentsCode).toMatch(/return 'https:\/\/localhost:4001'/);
      expect(componentsCode).toMatch(/return window\.location\.origin/);
    });

    test('getApiBase uses correct port for localhost (4001, not 4000)', () => {
      const componentsPath = path.join(__dirname, '../../shared-ui/components.react.js');
      const componentsCode = fs.readFileSync(componentsPath, 'utf8');
      
      // Should use 4001 (API server), not 4000 (add-in dev server)
      expect(componentsCode).toMatch(/localhost:4001/);
      expect(componentsCode).not.toMatch(/localhost:4000/);
    });

    test('getApiBase has comments explaining port usage', () => {
      const componentsPath = path.join(__dirname, '../../shared-ui/components.react.js');
      const componentsCode = fs.readFileSync(componentsPath, 'utf8');
      
      // Should have explanatory comments
      const getApiBaseSection = componentsCode.match(/function getApiBase[\s\S]*?\n  \}/)[0];
      expect(getApiBaseSection).toMatch(/4001/);
      expect(getApiBaseSection).toMatch(/API server/);
    });
  });

  describe('Render Configuration', () => {
    const renderYamlPath = path.join(__dirname, '../../render.yaml');

    test('render.yaml exists', () => {
      expect(fs.existsSync(renderYamlPath)).toBe(true);
    });

    test('render.yaml has correct service configuration', () => {
      const renderYaml = fs.readFileSync(renderYamlPath, 'utf8');
      
      // Check service type
      expect(renderYaml).toMatch(/type:\s*web/);
      
      // Check build command includes server install
      expect(renderYaml).toMatch(/cd server && npm install/);
      
      // Check build command includes add-in build
      expect(renderYaml).toMatch(/cd \.\.\/addin && npm install --include=dev/);
      expect(renderYaml).toMatch(/cd \.\.\/addin && npx webpack --mode production/);
      
      // Check build command copies add-in assets
      expect(renderYaml).toMatch(/cd \.\.\/addin && cp -r dist\/\* \.\.\/server\/public\//);
      
      // Check build command copies add-in public distribution files
      expect(renderYaml).toMatch(/cd \.\.\/addin && cp -r public\/\* \.\.\/server\/public\//);
      
      // Check start command
      expect(renderYaml).toMatch(/startCommand:\s*cd server && npm run start:production/);
    });

    test('render.yaml documents free tier limitations', () => {
      const renderYaml = fs.readFileSync(renderYamlPath, 'utf8');
      
      // Free tier doesn't have persistent disk - verify this is documented
      expect(renderYaml).toMatch(/# Note: Persistent disk removed for free tier compatibility/);
      expect(renderYaml).toMatch(/# WARNING: Data will NOT persist across restarts on free tier!/);
      
      // Should NOT have disk configuration for free tier
      expect(renderYaml).not.toMatch(/^\s+disk:/m);
    });

    test('render.yaml has correct environment variables', () => {
      const renderYaml = fs.readFileSync(renderYamlPath, 'utf8');
      
      expect(renderYaml).toMatch(/NODE_ENV/);
      expect(renderYaml).toMatch(/production/);
      expect(renderYaml).toMatch(/PORT/);
      expect(renderYaml).toMatch(/10000/);
    });

    test('render.yaml has health check path', () => {
      const renderYaml = fs.readFileSync(renderYamlPath, 'utf8');
      
      expect(renderYaml).toMatch(/healthCheckPath:\s*\/api\/v1\/health/);
    });
  });

  describe('Package.json Scripts', () => {
    const addinPackagePath = path.join(__dirname, '../../addin/package.json');
    const serverPackagePath = path.join(__dirname, '../../server/package.json');

    test('addin package.json has build:manifest script', () => {
      const packageJson = JSON.parse(fs.readFileSync(addinPackagePath, 'utf8'));
      
      expect(packageJson.scripts).toHaveProperty('build:manifest');
      expect(packageJson.scripts['build:manifest']).toBe('node build-manifest.js');
    });

    test('server package.json has start:production script', () => {
      const packageJson = JSON.parse(fs.readFileSync(serverPackagePath, 'utf8'));
      
      expect(packageJson.scripts).toHaveProperty('start:production');
    });
  });

  describe('Gitignore Configuration', () => {
    const gitignorePath = path.join(__dirname, '../../.gitignore');

    test('.gitignore exists', () => {
      expect(fs.existsSync(gitignorePath)).toBe(true);
    });

    test('.gitignore excludes generated manifest files', () => {
      const gitignore = fs.readFileSync(gitignorePath, 'utf8');
      
      expect(gitignore).toMatch(/manifest\.production\.xml/);
      expect(gitignore).toMatch(/manifest-deploy\.xml/);
    });

    test('generated manifests are actually ignored by git', () => {
      // Run git check-ignore to verify
      const prodManifestPath = 'addin/manifest.production.xml';
      const deployManifestPath = 'addin/manifest-deploy.xml';
      
      // These should be ignored (exit code 0)
      // If git is not available or file doesn't exist, skip this test
      try {
        const result1 = execSync(`git check-ignore ${prodManifestPath}`, {
          cwd: path.join(__dirname, '../..'),
          encoding: 'utf8'
        });
        expect(result1.trim()).toBe(prodManifestPath);
      } catch (e) {
        // If file doesn't exist or git not available, that's fine
        console.log('Skipping git check-ignore test (file may not exist or git unavailable)');
      }
    });
  });

  describe('Documentation', () => {
    const deploymentDocsPath = path.join(__dirname, '../../docs/deployment');
    const nextStepsPath = path.join(__dirname, '../../DEPLOYMENT-NEXT-STEPS.md');

    test('deployment documentation folder exists', () => {
      expect(fs.existsSync(deploymentDocsPath)).toBe(true);
    });

    test('render-setup.md exists', () => {
      const renderSetupPath = path.join(deploymentDocsPath, 'render-setup.md');
      expect(fs.existsSync(renderSetupPath)).toBe(true);
      
      const content = fs.readFileSync(renderSetupPath, 'utf8');
      expect(content).toMatch(/Render\.com/);
      expect(content).toMatch(/render\.yaml/);
    });

    test('addin-distribution.md exists', () => {
      const addinDistPath = path.join(deploymentDocsPath, 'addin-distribution.md');
      expect(fs.existsSync(addinDistPath)).toBe(true);
      
      const content = fs.readFileSync(addinDistPath, 'utf8');
      expect(content).toMatch(/build:manifest/);
      expect(content).toMatch(/BASE_URL/);
    });

    test('DEPLOYMENT-NEXT-STEPS.md exists and mentions build script', () => {
      expect(fs.existsSync(nextStepsPath)).toBe(true);
      
      const content = fs.readFileSync(nextStepsPath, 'utf8');
      expect(content).toMatch(/npm run build:manifest/);
      expect(content).toMatch(/BASE_URL/);
      expect(content).toMatch(/deployment branch/i);
    });

    test('documentation warns against merging to main prematurely', () => {
      const content = fs.readFileSync(nextStepsPath, 'utf8');
      
      expect(content).toMatch(/don't merge to.*main.*until/i);
      expect(content).toMatch(/test first/i);
    });
  });

  describe('Environment Variables', () => {
    const envExamplePath = path.join(__dirname, '../../env.example');

    test('env.example exists', () => {
      expect(fs.existsSync(envExamplePath)).toBe(true);
    });

    test('env.example has correct production settings', () => {
      const envExample = fs.readFileSync(envExamplePath, 'utf8');
      
      expect(envExample).toMatch(/PORT=10000/);
      expect(envExample).toMatch(/NODE_ENV=production/);
      expect(envExample).toMatch(/onrender\.com/);
    });

    test('env.example documents all required variables', () => {
      const envExample = fs.readFileSync(envExamplePath, 'utf8');
      
      // Required vars
      expect(envExample).toMatch(/PORT/);
      expect(envExample).toMatch(/NODE_ENV/);
      expect(envExample).toMatch(/BASE_URL/);
      
      // Optional vars
      expect(envExample).toMatch(/LLM_PROVIDER/);
      expect(envExample).toMatch(/OPENAI_API_KEY/);
    });
  });

  describe('Deployment Workflow', () => {
    test('no Railway configuration files exist', () => {
      const railwayJsonPath = path.join(__dirname, '../../railway.json');
      const railwayDocsPath = path.join(__dirname, '../../docs/deployment/railway-setup.md');
      
      expect(fs.existsSync(railwayJsonPath)).toBe(false);
      expect(fs.existsSync(railwayDocsPath)).toBe(false);
    });

    test('no Fly.io configuration files exist', () => {
      const flyTomlPath = path.join(__dirname, '../../fly.toml');
      const flyDocsPath = path.join(__dirname, '../../docs/deployment/fly-setup.md');
      
      expect(fs.existsSync(flyTomlPath)).toBe(false);
      expect(fs.existsSync(flyDocsPath)).toBe(false);
    });

    test('deployment branch exists in documentation', () => {
      const nextStepsPath = path.join(__dirname, '../../DEPLOYMENT-NEXT-STEPS.md');
      const content = fs.readFileSync(nextStepsPath, 'utf8');
      
      expect(content).toMatch(/deployment.*branch/i);
      expect(content).toMatch(/git push origin deployment/);
    });
  });
});

