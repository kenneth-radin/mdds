// Check the alerts index file structure
const fs = require('fs');
const path = require('path');
const cwd = process.cwd();
const target = path.join(cwd, '(app)', 'tabs', 'alerts', 'index.tsx');
console.log('Reading:', target);
try {
  const content = fs.readFileSync(target, 'utf8');
  console.log(content.slice(0, 4000));
} catch (e) {
  console.log('Error:', e.message);
}
