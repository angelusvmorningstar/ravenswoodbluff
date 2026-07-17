import { describe, it, expect } from 'vitest';
import { ruleE02, ruleW12, runRules } from '../../js/analyser.js';
import chars from '../../data/characters.json';

const charById = new Map(chars.map(c => [c.id, c]));

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

const ROSTER = ['empath', 'chef', 'imp', 'poisoner'];

describe('ruleE02 — no misinfo source', () => {
  it('returns null when droizonDensity > 0', () => {
    expect(ruleE02(ROSTER, makeContext({ droizonDensity: 2 }))).toBeNull();
  });

  it('returns null when droizonDensity === 1', () => {
    expect(ruleE02(ROSTER, makeContext({ droizonDensity: 1 }))).toBeNull();
  });

  it('returns a Finding when droizonDensity === 0', () => {
    const f = ruleE02(ROSTER, makeContext({ droizonDensity: 0 }));
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('E02');
    expect(f.rule).toBe('E02');
    expect(f.severity).toBe('hard_error');
    expect(f.type).toBe('script');
    expect(Array.isArray(f.characters)).toBe(true);
    expect(typeof f.notice_text).toBe('string');
    expect(typeof f.explainer_text).toBe('string');
    expect(Array.isArray(f.affected_characters)).toBe(true);
    expect(f.affected_characters).toEqual(f.characters);
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
  });
});

describe('ruleW12 — heretic without sentinel', () => {
  it('returns null when hasHeretic === false', () => {
    expect(ruleW12(ROSTER, makeContext({ hasHeretic: false, hasSentinel: false }))).toBeNull();
  });

  it('returns null when hasHeretic === true AND hasSentinel === true', () => {
    expect(ruleW12(ROSTER, makeContext({ hasHeretic: true, hasSentinel: true }))).toBeNull();
  });

  it('returns a Finding when hasHeretic === true AND hasSentinel === false', () => {
    const f = ruleW12(ROSTER, makeContext({ hasHeretic: true, hasSentinel: false }));
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W12');
    expect(f.rule).toBe('W12');
    expect(f.severity).toBe('soft_warning');
    expect(f.type).toBe('character');
    expect(f.characters).toContain('heretic');
    expect(f.affected_characters).toContain('heretic');
  });
});

describe('runRules — full output shape', () => {
  it('E02 fires into errors when droizonDensity === 0', () => {
    const ctx = makeContext({ droizonDensity: 0, hasHeretic: false });
    const result = runRules(ROSTER, charById, ctx, {});
    expect(result.errors.some(f => f.rule_id === 'E02')).toBe(true);
    expect(result.warnings.some(f => f.rule_id === 'E02')).toBe(false);
  });

  it('W12 fires into warnings when heretic without sentinel', () => {
    const ctx = makeContext({ droizonDensity: 2, hasHeretic: true, hasSentinel: false });
    const result = runRules(ROSTER, charById, ctx, {});
    expect(result.warnings.some(f => f.rule_id === 'W12')).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('output is flat serialisable JSON (NFR9)', () => {
    const ctx = makeContext({ droizonDensity: 0, hasHeretic: true, hasSentinel: false });
    const result = runRules(ROSTER, charById, ctx, {});
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('atheist_mode degrades E02 hard_error to soft_warning in warnings', () => {
    const ctx = makeContext({ droizonDensity: 0 });
    const result = runRules(ROSTER, charById, ctx, { atheist_mode: true });
    expect(result.errors).toHaveLength(0);
    const w = result.warnings.find(f => f.rule_id === 'E02');
    expect(w).toBeDefined();
    expect(w.severity).toBe('soft_warning');
  });

  it('atheist_mode degrades W12 soft_warning to informational in notices', () => {
    const ctx = makeContext({ droizonDensity: 2, hasHeretic: true, hasSentinel: false });
    const result = runRules(ROSTER, charById, ctx, { atheist_mode: true });
    expect(result.warnings).toHaveLength(0);
    const n = result.notices.find(f => f.rule_id === 'W12');
    expect(n).toBeDefined();
    expect(n.severity).toBe('informational');
  });

  it('clean case — no rules fire when context is clear', () => {
    const ctx = makeContext({
      droizonDensity: 2, hasHeretic: false,
      townsfolkCount: 13, outsiderCount: 4, minionCount: 4, demonCount: 1,
      hasOutsiderObfuscation: true, hasExtraEvil: false, strongEvilRoles: [],
      jinxCount: 0,
    });
    // soldier provides night protection so W17 does not fire alongside imp
    const result = runRules(['empath', 'chef', 'soldier', 'imp', 'poisoner'], charById, ctx, {});
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.notices).toHaveLength(0);
  });
});

describe('Finding kind/provenance foundation (v3.1)', () => {
  it('every finding carries kind:"verdict" and a null provenance', () => {
    const roster = ['empath', 'chef', 'vortox', 'poisoner'];
    const ctx = makeContext({ droizonDensity: 0, townsfolkCount: 13, hasOutsiderObfuscation: false });
    const { errors, warnings, notices } = runRules(roster, charById, ctx);
    const all = [...errors, ...warnings, ...notices];
    expect(all.length).toBeGreaterThan(0);
    for (const f of all) {
      expect(f.kind).toBe('verdict');
      expect('provenance' in f).toBe(true);
      expect(f.provenance).toBeNull();
    }
  });

  it('findings remain JSON-serialisable with the new fields', () => {
    const { errors, warnings, notices } = runRules(
      ['empath', 'chef', 'vortox', 'poisoner'],
      charById,
      makeContext({ droizonDensity: 0 }),
    );
    expect(() => JSON.stringify({ errors, warnings, notices })).not.toThrow();
  });
});

describe('Advisory pipeline (v3.3 / C3)', () => {
  const roster = ['empath', 'chef', 'imp', 'poisoner'];

  it('ruleA01 emits a kind:"advisory" finding with severity null and a provenance tag', async () => {
    const { ruleA01 } = await import('../../js/analyser.js');
    const a = ruleA01(roster, makeContext({ droizonDensity: 1 }), charById);
    expect(a.kind).toBe('advisory');
    expect(a.severity).toBeNull();
    expect(a.rule_id).toBe('A01');
    expect(a.provenance).toBe('community');
    expect(a.value).toBe(1);
  });

  it('runRules returns an advisories stream containing the advisory', () => {
    const { advisories } = runRules(roster, charById, makeContext());
    expect(Array.isArray(advisories)).toBe(true);
    expect(advisories.some(a => a.rule_id === 'A01')).toBe(true);
  });

  it('advisories never leak into the errors/warnings/notices gate', () => {
    // droizonDensity 0 forces hard errors + warnings to also fire, exercising the gate.
    const { errors, warnings, notices, advisories } = runRules(
      roster, charById, makeContext({ droizonDensity: 0, townsfolkCount: 13, hasOutsiderObfuscation: false }),
    );
    for (const bucket of [errors, warnings, notices]) {
      for (const f of bucket) expect(f.kind).toBe('verdict');
    }
    expect(advisories.every(a => a.kind === 'advisory')).toBe(true);
    expect(advisories.length).toBeGreaterThan(0);
  });
});
