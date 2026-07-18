// Data-integrity guard for the nine-script set (added 2026-07-18).
//
// THE DRIFT GUARD. The roster of each script lives in THREE hand-touchable
// places that must never disagree:
//   1. jsons/<Name>.json          - the build source (legacy NO-HYPHEN ids)
//   2. src/data/my-scripts.json   - the canonical runtime artefact (hyphen ids)
//   3. src/data/scripts/<id>.json - the per-script preset (hyphen ids)
// build-my-scripts.py regenerates (2) from (1), so if (1) is edited without
// updating (2)/(3) - or vice versa - a rebuild silently reverts design work.
// This test fails on ANY such divergence, and on any non-canonical / unknown /
// duplicate / Fabled id, so drift can never regress through `npm test` unseen.
//
// CANONICAL ID FORM: hyphenated kebab-case, exactly as characters.json defines
// it (bounty-hunter, plague-doctor, lord-of-typhon). The jsons/ no-hyphen form
// is legacy; it is compared here by hyphen-insensitive key only.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd(); // vitest runs from the ravenswoodbluff project root
const read = p => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

const chars = read('src/data/characters.json');
const myScripts = read('src/data/my-scripts.json');
const idSet = new Set(chars.map(c => c.id));
const teamOf = id => (chars.find(c => c.id === id) || {}).team;

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const stripKey = ids => [...ids].map(s => s.toLowerCase().replace(/-/g, '')).sort().join(',');
const rosterOf = arr => arr.filter(x => typeof x === 'string'); // drops the {_meta} head

describe('data integrity — script compositions', () => {
  for (const s of myScripts) {
    describe(s.name, () => {
      const roster = s.characters;

      test('every id is canonical kebab-case AND exists in characters.json', () => {
        for (const id of roster) {
          expect(KEBAB.test(id), `"${id}" is not kebab-case`).toBe(true);
          expect(idSet.has(id), `unknown/non-canonical id "${id}" (not in characters.json)`).toBe(true);
        }
      });

      test('no duplicate characters', () => {
        expect(roster.length - new Set(roster).size).toBe(0);
      });

      test('no Fabled (hard set constraint)', () => {
        expect(roster.filter(id => teamOf(id) === 'fabled')).toEqual([]);
      });

      test('no Travellers / non-official teams in the composition', () => {
        expect(roster.filter(id => ['traveller', 'loric'].includes(teamOf(id)))).toEqual([]);
      });

      test('team composition is 13 / 4 / 4 / demon (2 for Gentle Night, else 4)', () => {
        const n = t => roster.filter(id => teamOf(id) === t).length;
        expect(n('townsfolk')).toBe(13);
        expect(n('outsider')).toBe(4);
        expect(n('minion')).toBe(4);
        expect(n('demon')).toBe(s.name === 'Gentle Night' ? 2 : 4);
      });

      test('preset (src/data/scripts) and source (jsons/) agree with my-scripts — no drift', () => {
        const canonical = stripKey(roster);
        const preset = rosterOf(read(`src/data/scripts/${s.id}.json`));
        const source = rosterOf(read(`../jsons/${s.name}.json`));
        expect(stripKey(preset), `src/data/scripts/${s.id}.json drifted from my-scripts.json`).toBe(canonical);
        expect(stripKey(source), `jsons/${s.name}.json (build source) drifted from my-scripts.json`).toBe(canonical);
      });
    });
  }
});

describe('data integrity — set level', () => {
  test('full official coverage: every official character is used at least once', () => {
    const used = new Set(myScripts.flatMap(s => s.characters));
    const unused = chars
      .filter(c => ['townsfolk', 'outsider', 'minion', 'demon'].includes(c.team))
      .filter(c => !used.has(c.id))
      .map(c => c.id);
    expect(unused, `unused official characters: ${unused.join(', ')}`).toEqual([]);
  });
});
