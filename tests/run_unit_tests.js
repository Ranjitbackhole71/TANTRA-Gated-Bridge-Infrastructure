const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const unitDir = path.join(__dirname, 'unit');
const files = fs.readdirSync(unitDir)
  .filter(file => file.endsWith('.test.js'))
  .sort()
  .map(file => path.join(unitDir, file));

if (files.length === 0) {
  console.error('No maintained unit tests found');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
