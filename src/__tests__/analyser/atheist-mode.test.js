import { describe, it, expect } from 'vitest';
import { runRules } from '../../js/analyser.js';
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

const ROSTER = ['empath', 'chef', 'soldier', 'imp', 'poisoner'];

describe('atheist_mode — auto-activation via hasAtheist', () => {
  it('hard_error degrades to soft_warning when hasAtheist:true and options={}', () => {
    // droizonDensity:0 → E02 fires as hard_error normally
    const ctx = makeContext({ hasAtheist: true, droizonDensity: 0 });
    const result = runRules(ROSTER, charById, ctx, {});
    expect(result.errors).toHaveLength(0);
    const w = result.warnings.find(f => f.rule_id === 'E02');
    expect(w).toBeDefined();
    expect(w.severity).toBe('soft_warning');
  });

  it('soft_warning degrades to informational when hasAtheist:true and options={}', () => {
    // hasHeretic:true, hasSentinel:false → W12 fires as soft_warning normally
    const ctx = makeContext({ hasAtheist: true, hasHeretic: true, hasSentinel: false });
    const result = runRules(ROSTER, charById, ctx, {});
    expect(result.warnings.some(f => f.rule_id === 'W12')).toBe(false);
    const n = result.notices.find(f => f.rule_id === 'W12');
    expect(n).toBeDefined();
    expect(n.severity).toBe('informational');
  });

  it('all E-rule errors degrade to warnings when hasAtheist:true', () => {
    const ctx = makeContext({ hasAtheist: true, droizonDensity: 0, townsfolkCount: 1 });
    const result = runRules(ROSTER, charById, ctx, {});
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('atheist_mode — explicit opt-out overrides hasAtheist', () => {
  it('hard_error stays in errors when atheist_mode:false overrides hasAtheist:true', () => {
    const ctx = makeContext({ hasAtheist: true, droizonDensity: 0 });
    const result = runRules(ROSTER, charById, ctx, { atheist_mode: false });
    expect(result.errors.some(f => f.rule_id === 'E02')).toBe(true);
    expect(result.warnings.some(f => f.rule_id === 'E02')).toBe(false);
  });

  it('soft_warning stays in warnings when atheist_mode:false overrides hasAtheist:true', () => {
    const ctx = makeContext({ hasAtheist: true, hasHeretic: true, hasSentinel: false });
    const result = runRules(ROSTER, charById, ctx, { atheist_mode: false });
    expect(result.warnings.some(f => f.rule_id === 'W12')).toBe(true);
  });
});

describe('atheist_mode — explicit opt-in even when hasAtheist:false', () => {
  it('hard_error degrades when atheist_mode:true even with hasAtheist:false', () => {
    const ctx = makeContext({ hasAtheist: false, droizonDensity: 0 });
    const result = runRules(ROSTER, charById, ctx, { atheist_mode: true });
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some(f => f.rule_id === 'E02')).toBe(true);
  });

  it('soft_warning degrades when atheist_mode:true even with hasAtheist:false', () => {
    const ctx = makeContext({ hasAtheist: false, hasHeretic: true, hasSentinel: false });
    const result = runRules(ROSTER, charById, ctx, { atheist_mode: true });
    expect(result.warnings.some(f => f.rule_id === 'W12')).toBe(false);
    expect(result.notices.some(f => f.rule_id === 'W12')).toBe(true);
  });
});

describe('atheist_mode — informational findings are unaffected', () => {
  it('informational Finding stays informational with atheist_mode:true', () => {
    // N41 fires when confirmationCluster.size >= 3
    const ctx = makeContext({
      hasAtheist: true,
      confirmationCluster: new Set(['slayer', 'virgin', 'fool']),
    });
    const result = runRules(ROSTER, charById, ctx, {});
    const n41 = result.notices.find(f => f.rule_id === 'N41');
    expect(n41).toBeDefined();
    expect(n41.severity).toBe('informational');
  });
});

describe('atheist_mode — NFR9 serialisability', () => {
  it('output is flat serialisable JSON in atheist_mode', () => {
    const ctx = makeContext({ hasAtheist: true, droizonDensity: 0, hasHeretic: true, hasSentinel: false });
    const result = runRules(ROSTER, charById, ctx, {});
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
