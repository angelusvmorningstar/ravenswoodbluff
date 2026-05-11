import { describe, it, expect } from 'vitest';
import { ruleE04, ruleJinxPairs, runRules } from '../../js/analyser.js';
import chars from '../../data/characters.json';

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
  hasAtheist: false, hasHeretic: true, hasSentinel: false, hasSpiritOfIvory: false,
};
function makeContext(overrides) { return { ...BASE_CTX, ...overrides }; }

// ─── ruleE04 — hate pair hard_error ──────────────────────────────────────────

describe('ruleE04 — heretic + baron (hate pair)', () => {
  it('fires hard_error when hate pair on roster without Sentinel', () => {
    const findings = ruleE04(['heretic', 'baron', 'imp'], makeContext(), realCharById);
    const f = findings.find(fi => fi.rule_id === 'E04');
    expect(f).toBeDefined();
    expect(f.severity).toBe('hard_error');
    expect(f.type).toBe('pair');
    expect(f.affected_characters).toContain('heretic');
    expect(f.affected_characters).toContain('baron');
    expect(f.missing_mitigations).toContain('sentinel');
  });

  it('returns [] when Sentinel is on script (hasSentinel: true)', () => {
    const findings = ruleE04(['heretic', 'baron', 'imp'], makeContext({ hasSentinel: true }), realCharById);
    expect(findings.filter(fi => fi.rule_id === 'E04')).toHaveLength(0);
  });

  it('returns [] when Sentinel is in the roster', () => {
    const findings = ruleE04(['heretic', 'baron', 'sentinel', 'imp'], makeContext({ hasSentinel: true }), realCharById);
    expect(findings.filter(fi => fi.rule_id === 'E04')).toHaveLength(0);
  });
});

describe('ruleE04 — heretic + spy (second hate pair)', () => {
  it('fires hard_error for heretic + spy without Sentinel', () => {
    const findings = ruleE04(['heretic', 'spy', 'imp'], makeContext(), realCharById);
    const f = findings.find(fi =>
      fi.rule_id === 'E04' && fi.affected_characters.includes('spy'));
    expect(f).toBeDefined();
    expect(f.severity).toBe('hard_error');
  });

  it('returns [] for heretic + spy with Sentinel', () => {
    const findings = ruleE04(['heretic', 'spy', 'imp'], makeContext({ hasSentinel: true }), realCharById);
    expect(findings.filter(fi => fi.rule_id === 'E04')).toHaveLength(0);
  });
});

describe('ruleE04 — heretic + widow (hate pair)', () => {
  it('fires hard_error for heretic + widow without Sentinel', () => {
    const findings = ruleE04(['heretic', 'widow', 'imp'], makeContext(), realCharById);
    const f = findings.find(fi => fi.rule_id === 'E04' && fi.affected_characters.includes('widow'));
    expect(f).toBeDefined();
    expect(f.severity).toBe('hard_error');
    expect(f.missing_mitigations).toContain('sentinel');
  });
});

describe('ruleE04 — heretic + lleech (hate pair)', () => {
  it('fires hard_error for heretic + lleech without Sentinel', () => {
    const findings = ruleE04(['heretic', 'lleech', 'imp'], makeContext(), realCharById);
    const f = findings.find(fi => fi.rule_id === 'E04' && fi.affected_characters.includes('lleech'));
    expect(f).toBeDefined();
    expect(f.severity).toBe('hard_error');
  });
});

describe('ruleE04 — multiple hate pairs on the same roster', () => {
  it('returns two E04 findings when heretic + baron + spy are all on roster', () => {
    const findings = ruleE04(['heretic', 'baron', 'spy', 'imp'], makeContext(), realCharById);
    expect(findings.filter(fi => fi.rule_id === 'E04')).toHaveLength(2);
  });

  it('returns [] for all hate pairs when Sentinel suppresses everything', () => {
    const findings = ruleE04(['heretic', 'baron', 'spy', 'imp'], makeContext({ hasSentinel: true }), realCharById);
    expect(findings.filter(fi => fi.rule_id === 'E04')).toHaveLength(0);
  });
});

// ─── ruleJinxPairs — hate pairs are still informational N01 ──────────────────

describe('ruleJinxPairs — hate pair fires as informational regardless of Sentinel', () => {
  it('fires N01 informational for heretic + baron (no Sentinel)', () => {
    const findings = ruleJinxPairs(['heretic', 'baron', 'imp'], realCharById);
    const f = findings.find(fi => fi.rule_id === 'N01' &&
      fi.characters.includes('heretic') && fi.characters.includes('baron'));
    expect(f).toBeDefined();
    expect(f.severity).toBe('informational');
    expect(f.type).toBe('pair');
  });

  it('fires N01 informational for heretic + baron even WITH Sentinel', () => {
    const findings = ruleJinxPairs(['heretic', 'baron', 'sentinel', 'imp'], realCharById);
    const f = findings.find(fi => fi.rule_id === 'N01' &&
      fi.characters.includes('heretic') && fi.characters.includes('baron'));
    expect(f).toBeDefined();
    expect(f.severity).toBe('informational');
  });
});

// ─── runRules integration — dual appearance ───────────────────────────────────

describe('runRules — hate pair without Sentinel: dual appearance', () => {
  it('E04 in errors AND N01 in notices AND djinn_required: true', () => {
    const result = runRules(
      ['heretic', 'baron', 'soldier', 'imp', 'poisoner'],
      realCharById,
      makeContext({ hasHeretic: true, hasSentinel: false }),
      {}
    );
    expect(result.errors.some(f => f.rule_id === 'E04')).toBe(true);
    expect(result.notices.some(f => f.rule_id === 'N01' &&
      f.characters.includes('heretic') && f.characters.includes('baron'))).toBe(true);
    expect(result.djinn_required).toBe(true);
  });
});

describe('runRules — hate pair WITH Sentinel: no E04, N01 still present', () => {
  it('no E04 in errors, N01 still in notices, djinn_required: true', () => {
    const result = runRules(
      ['heretic', 'baron', 'sentinel', 'soldier', 'imp', 'poisoner'],
      realCharById,
      makeContext({ hasHeretic: true, hasSentinel: true }),
      {}
    );
    expect(result.errors.some(f => f.rule_id === 'E04')).toBe(false);
    expect(result.notices.some(f => f.rule_id === 'N01' &&
      f.characters.includes('heretic') && f.characters.includes('baron'))).toBe(true);
    expect(result.djinn_required).toBe(true);
  });
});

describe('runRules — hate pair with atheist_mode: true', () => {
  it('E04 degrades to soft_warning in warnings; N01 remains informational in notices', () => {
    const result = runRules(
      ['heretic', 'baron', 'soldier', 'imp', 'poisoner'],
      realCharById,
      makeContext({ hasHeretic: true, hasSentinel: false }),
      { atheist_mode: true }
    );
    expect(result.errors.some(f => f.rule_id === 'E04')).toBe(false);
    const e04Degraded = result.warnings.find(f => f.rule_id === 'E04');
    expect(e04Degraded).toBeDefined();
    expect(e04Degraded.severity).toBe('soft_warning');
    expect(result.notices.some(f => f.rule_id === 'N01' &&
      f.characters.includes('heretic') && f.characters.includes('baron'))).toBe(true);
  });
});
