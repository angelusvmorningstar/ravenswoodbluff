import { describe, it, expect } from 'vitest';
import { ruleJinxPairs, runRules } from '../../js/analyser.js';
import chars from '../../data/characters.json';
import jinxes from '../../data/jinxes.json';

const realCharById = new Map(chars.map(c => [c.id, c]));

const BASE_CTX = {
  droizonDensity: 2,
  hasOutsiderObfuscation: true,
  hasExtraEvil: false,
  strongEvilRoles: [],
  jinxCount: 0,
  confirmationCluster: new Set(),
  executionSurvivalCluster: new Set(),
  minionVolumeScore: { min: null, max: null, spread: 0, tiers: [] },
  demonCount: 1, minionCount: 4, outsiderCount: 4, townsfolkCount: 13,
  hasAtheist: false, hasHeretic: false, hasSentinel: false, hasSpiritOfIvory: false,
};
function makeContext(overrides) { return { ...BASE_CTX, ...overrides }; }

// Confirm first mechanical jinx pair used in tests
const ALCHEMIST_BOFFIN = jinxes.find(j =>
  j.characters.includes('alchemist') && j.characters.includes('boffin'));
const HERETIC_BARON = jinxes.find(j =>
  j.characters.includes('heretic') && j.characters.includes('baron'));

// ─── ruleJinxPairs — mechanical pair ─────────────────────────────────────────

describe('ruleJinxPairs — mechanical jinx pair', () => {
  it('returns a Finding when both characters of a jinxed pair are on roster', () => {
    const findings = ruleJinxPairs(['alchemist', 'boffin', 'imp'], realCharById);
    const f = findings.find(fi => fi.characters.includes('alchemist'));
    expect(f).toBeDefined();
    expect(f.rule_id).toBe('N01');
    expect(f.severity).toBe('informational');
    expect(f.type).toBe('pair');
    expect(f.notice_text).toBe(ALCHEMIST_BOFFIN.djinnRule);
    expect(f.affected_characters).toContain('alchemist');
    expect(f.affected_characters).toContain('boffin');
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
    expect(typeof f.explainer_text).toBe('string');
    expect(() => JSON.stringify(f)).not.toThrow();
  });

  it('returns empty array when only one of the pair is on roster', () => {
    const findings = ruleJinxPairs(['alchemist', 'imp', 'chef'], realCharById);
    expect(findings.filter(fi => fi.characters.includes('boffin'))).toHaveLength(0);
  });

  it('returns empty array when neither of the pair is on roster', () => {
    const findings = ruleJinxPairs(['empath', 'imp', 'poisoner'], realCharById);
    expect(findings).toHaveLength(0);
  });

  it('f.characters contains both members of the matched pair', () => {
    const findings = ruleJinxPairs(['alchemist', 'boffin', 'imp'], realCharById);
    const f = findings.find(fi => fi.rule_id === 'N01' && fi.characters.includes('alchemist'));
    expect(f.characters).toContain('alchemist');
    expect(f.characters).toContain('boffin');
  });
});

// ─── ruleJinxPairs — hate pair ────────────────────────────────────────────────

describe('ruleJinxPairs — hate jinx pair', () => {
  it('hate pair fires as informational N01, not hard_error', () => {
    const findings = ruleJinxPairs(['heretic', 'baron', 'imp'], realCharById);
    const f = findings.find(fi =>
      fi.characters.includes('heretic') && fi.characters.includes('baron'));
    expect(f).toBeDefined();
    expect(f.rule_id).toBe('N01');
    expect(f.severity).toBe('informational');
    expect(f.type).toBe('pair');
    expect(f.notice_text).toBe(HERETIC_BARON.djinnRule);
  });

  it('hate pair does not fire hard_error via ruleJinxPairs', () => {
    const findings = ruleJinxPairs(['heretic', 'baron', 'imp'], realCharById);
    expect(findings.every(fi => fi.severity === 'informational')).toBe(true);
  });

  it('hate pair affected_characters contains both members', () => {
    const findings = ruleJinxPairs(['heretic', 'baron', 'imp'], realCharById);
    const f = findings.find(fi => fi.characters.includes('heretic') && fi.characters.includes('baron'));
    expect(f.affected_characters).toContain('heretic');
    expect(f.affected_characters).toContain('baron');
  });
});

// ─── ruleJinxPairs — multiple pairs ──────────────────────────────────────────

describe('ruleJinxPairs — multiple pairs on roster', () => {
  it('returns one Finding per matching pair', () => {
    // alchemist+boffin is one pair; slayer+lleech is another
    const findings = ruleJinxPairs(['alchemist', 'boffin', 'slayer', 'lleech', 'imp'], realCharById);
    const n01s = findings.filter(fi => fi.rule_id === 'N01');
    expect(n01s.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── ruleJinxPairs — NFR9 serialisability ────────────────────────────────────

describe('ruleJinxPairs — NFR9', () => {
  it('output is flat serialisable JSON', () => {
    const findings = ruleJinxPairs(['alchemist', 'boffin', 'heretic', 'baron', 'imp'], realCharById);
    expect(() => JSON.stringify(findings)).not.toThrow();
  });
});

// ─── runRules integration ─────────────────────────────────────────────────────

describe('runRules — jinx-pairs integration', () => {
  it('N01 finding lands in notices for a known jinxed pair', () => {
    const result = runRules(
      ['alchemist', 'boffin', 'soldier', 'imp', 'poisoner'],
      realCharById,
      makeContext(),
      {}
    );
    const n01 = result.notices.find(f =>
      f.rule_id === 'N01' && f.characters.includes('alchemist'));
    expect(n01).toBeDefined();
    expect(n01.severity).toBe('informational');
    expect(n01.type).toBe('pair');
  });

  it('no N01 findings when roster has no jinxed pairs', () => {
    const result = runRules(
      ['empath', 'chef', 'soldier', 'imp', 'poisoner'],
      realCharById,
      makeContext(),
      {}
    );
    expect(result.notices.filter(f => f.rule_id === 'N01')).toHaveLength(0);
  });

  it('output is flat serialisable JSON (NFR9)', () => {
    const result = runRules(
      ['alchemist', 'boffin', 'soldier', 'imp', 'poisoner'],
      realCharById,
      makeContext(),
      {}
    );
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
