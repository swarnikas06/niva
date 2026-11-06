const fs = require('fs');
const path = require('path');

const distIndexJs = path.resolve(__dirname, '..', 'dist', 'index.js');
const distIndexCjs = path.resolve(__dirname, '..', 'dist', 'index.cjs');

const proxyContent = `// Universal runtime Proxy fallback for pure TypeScript types and interfaces
const runtimeProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return {};
    return {};
  }
});

module.exports = runtimeProxy;
module.exports.default = runtimeProxy;
`;

fs.writeFileSync(distIndexJs, proxyContent, 'utf8');
fs.writeFileSync(distIndexCjs, proxyContent, 'utf8');
console.log('[shared-types] Generated runtime Proxy fallback at dist/index.js and dist/index.cjs');
