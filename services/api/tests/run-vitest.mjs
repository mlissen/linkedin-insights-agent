import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rawArgs = process.argv.slice(2);
const sanitizedArgs = [];

for (let i = 0; i < rawArgs.length; i += 1) {
  const current = rawArgs[i];
  if (current === '--workspaces') {
    continue;
  }
  if (current === '--selectProjects') {
    i += 1;
    continue;
  }
  if (current === '--') {
    continue;
  }
  sanitizedArgs.push(current);
}

if (!sanitizedArgs.includes('--run')) {
  sanitizedArgs.unshift('--run');
}

const thisDir = dirname(fileURLToPath(import.meta.url));
const vitestBin = resolve(thisDir, '../../../node_modules/vitest/vitest.mjs');

const result = spawnSync(process.execPath, [vitestBin, ...sanitizedArgs], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
