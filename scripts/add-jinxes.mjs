// Story 1.6: add jinxes[] and v2_open_questions[] to all core characters
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'src', 'data');

const jinxesRaw = JSON.parse(readFileSync(join(dataDir, 'jinxes.json'), 'utf8'));
const chars = JSON.parse(readFileSync(join(dataDir, 'characters-v2.1.json'), 'utf8'));

// Determine sub_type for each jinx pair
const INFO_AMP_PAIRS = new Set([
  'chambermaid|mathematician',
  'drunk|mathematician',
  'lunatic|mathematician',
  'marionette|mathematician',
  'recluse|ogre',
  'recluse|sage',
]);
const SETUP_TRANS_PAIRS = new Set([
  'magician|spy',
  'magician|widow',
  'poppy-grower|spy',
  'poppy-grower|widow',
  'ogre|spy',
]);
const WINCON_PAIRS = new Set([
  'leviathan|mayor',
  'mayor|riot',
]);

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function getSubType(pair) {
  if (pair.type === 'hate') return 'hate';
  const key = pairKey(pair.characters[0], pair.characters[1]);
  if (INFO_AMP_PAIRS.has(key)) return 'info-amplifying';
  if (SETUP_TRANS_PAIRS.has(key)) return 'setup-transparency-altering';
  if (WINCON_PAIRS.has(key)) return 'wincon-modifying';
  return 'mechanical-patch';
}

// Build per-character jinx map: charId -> [ { partner_id, sub_type, canonical_text } ]
const jinxMap = {};
for (const pair of jinxesRaw) {
  const [a, b] = pair.characters;
  const sub_type = getSubType(pair);
  const canonical_text = pair.djinnRule;

  if (!jinxMap[a]) jinxMap[a] = [];
  if (!jinxMap[b]) jinxMap[b] = [];

  jinxMap[a].push({ partner_id: b, sub_type, canonical_text });
  jinxMap[b].push({ partner_id: a, sub_type, canonical_text });
}

const CORE_TEAMS = new Set(['townsfolk', 'outsider', 'minion', 'demon']);

// Characters already carrying v2_open_questions from prior stories
const EXISTING_OQ = new Set(['fool', 'mayor', 'professor', 'sailor', 'slayer', 'tea-lady', 'boffin']);

let coreCount = 0;
let jinxedCount = 0;
let oqAddedCount = 0;

const updated = chars.map(c => {
  if (!CORE_TEAMS.has(c.team)) return c;
  coreCount++;

  const result = { ...c };

  // Add jinxes[] after v2_1_status (or at end if absent)
  if (!('jinxes' in result)) {
    result.jinxes = jinxMap[c.id] ?? [];
    if (result.jinxes.length > 0) jinxedCount++;
  }

  // Add v2_open_questions[] if not already present
  if (!('v2_open_questions' in result)) {
    result.v2_open_questions = [];
    oqAddedCount++;
  }

  return result;
});

writeFileSync(join(dataDir, 'characters-v2.1.json'), JSON.stringify(updated, null, 2), 'utf8');

console.log(`Core entries processed: ${coreCount}`);
console.log(`Characters with jinx partners: ${jinxedCount}`);
console.log(`v2_open_questions[] added (previously absent): ${oqAddedCount}`);
console.log('Done.');
