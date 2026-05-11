/**
 * Validates night-first.json and night-other.json against night-order.schema.json.
 * Runs as part of the prebuild pipeline — exits non-zero on any violation.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const dataDir = resolve(root, 'src', 'data');

const VALID_TYPES = new Set(['phase', 'character']);
const VALID_PHASES = new Set(['Dusk', 'Dawn', 'Minion info', 'Demon info']);
const EXPECTED_COUNTS = { 'night-first.json': 70, 'night-other.json': 84 };

const characters = JSON.parse(readFileSync(resolve(dataDir, 'characters.json'), 'utf-8'));
const characterIds = new Set(characters.map(c => c.id));

let errors = 0;

function fail(file, idx, msg) {
  console.error(`  ${file}[${idx}]: ${msg}`);
  errors++;
}

for (const [file, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
  const path = resolve(dataDir, file);
  let rows;
  try {
    rows = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    console.error(`validate-night-order: cannot read ${file}: ${e.message}`);
    errors++;
    continue;
  }

  if (!Array.isArray(rows)) {
    console.error(`validate-night-order: ${file} is not an array`);
    errors++;
    continue;
  }

  if (rows.length !== expectedCount) {
    console.error(`validate-night-order: ${file} has ${rows.length} rows, expected ${expectedCount}`);
    errors++;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!VALID_TYPES.has(row.type)) {
      fail(file, i, `unknown type "${row.type}"`);
      continue;
    }

    if (row.type === 'phase') {
      if (!VALID_PHASES.has(row.name)) fail(file, i, `unknown phase name "${row.name}"`);
      if (typeof row.effect !== 'string') fail(file, i, `effect must be string`);
      if ('id' in row || 'token' in row) fail(file, i, `phase row has unexpected fields`);
    } else {
      if (typeof row.id !== 'string' || !row.id) fail(file, i, `id must be non-empty string`);
      if (typeof row.effect !== 'string') fail(file, i, `effect must be string`);
      if (row.token === null || row.token === undefined) fail(file, i, `token must be string, not null`);
      if (typeof row.token !== 'string') fail(file, i, `token must be string`);
      if (!characterIds.has(row.id)) fail(file, i, `id "${row.id}" not found in characters.json`);
      if ('name' in row) fail(file, i, `character row has unexpected "name" field`);
    }
  }

  // Check required phase sentinels present
  const phaseNames = new Set(rows.filter(r => r.type === 'phase').map(r => r.name));
  for (const phase of ['Dusk', 'Dawn']) {
    if (!phaseNames.has(phase)) {
      console.error(`validate-night-order: ${file} missing required phase sentinel "${phase}"`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`validate-night-order: ${errors} error(s) found`);
  process.exit(1);
}

console.log('validate-night-order: OK');
