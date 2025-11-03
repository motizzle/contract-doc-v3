// Copies SuperDoc UMD builds from installed package into server/public/vendor/superdoc
// Run with: npm run vendor:superdoc

const fs = require('fs');
const path = require('path');

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('Copied', src, '->', dest);
}

function main() {
  try {
    const root = path.resolve(__dirname, '..');
    const srcDir = path.join(root, 'node_modules', '@harbour-enterprises', 'superdoc', 'dist');
    const outDir = path.join(root, 'public', 'vendor', 'superdoc');
    
    // Copy UMD bundle (newer versions don't ship a minified version)
    copy(path.join(srcDir, 'superdoc.umd.js'), path.join(outDir, 'superdoc.umd.js'));
    copy(path.join(srcDir, 'style.css'), path.join(outDir, 'style.css'));
    
    // Create a copy as .min.js for backwards compatibility with existing code
    copy(path.join(srcDir, 'superdoc.umd.js'), path.join(outDir, 'superdoc.umd.min.js'));
    
    console.log('Done. Restart servers to load new SuperDoc version.');
  } catch (e) {
    console.error('vendor-superdoc failed', e);
    process.exit(1);
  }
}

main();

