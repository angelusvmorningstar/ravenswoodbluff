import { describe, it, expect } from 'vitest';
import { ruleW21, ruleW22, ruleW23, runRules } from '../../js/analyser.js';
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
  hasAtheist: false, hasHeretic: false, hasSentinel: false, hasSpiritOfIvory: false,
};
function makeContext(overrides) { return { ...BASE_CTX, ...overrides }; }

// ─── ruleW21 — Slayer + Lleech interaction ────────────────────────────────────

describe('ruleW21 — Slayer + Lleech jinx awareness', () => {
  it('returns null when neither slayer nor lleech on roster', () => {
    expect(ruleW21(['imp', 'chef', 'empath'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when only slayer on roster', () => {
    expect(ruleW21(['slayer', 'imp', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when only lleech on roster', () => {
    expect(ruleW21(['lleech', 'imp', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when slayer and lleech both on roster', () => {
    const f = ruleW21(['slayer', 'lleech', 'imp'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W21');
    expect(f.severity).toBe('soft_warning');
    expect(f.type).toBe('character');
    expect(f.characters).toContain('slayer');
    expect(f.characters).toContain('lleech');
    expect(f.affected_characters).toContain('slayer');
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
  });
});

// ─── ruleW22 — Grandmother + loud Demon ──────────────────────────────────────

describe('ruleW22 — Grandmother + loud Demon', () => {
  it('returns null when grandmother is not on roster', () => {
    expect(ruleW22(['leviathan', 'imp', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when grandmother on roster but no loud Demon', () => {
    expect(ruleW22(['grandmother', 'imp', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when grandmother and leviathan (loud) both on roster', () => {
    const f = ruleW22(['grandmother', 'leviathan', 'poisoner'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W22');
    expect(f.severity).toBe('soft_warning');
    expect(f.type).toBe('character');
    expect(f.characters).toContain('grandmother');
    expect(f.characters).toContain('leviathan');
  });

  it('returns a Finding when grandmother and riot (loud) both on roster', () => {
    const f = ruleW22(['grandmother', 'riot', 'poisoner'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W22');
    expect(f.characters).toContain('riot');
  });

  it('returns a Finding when grandmother and al-hadikhia (loud) both on roster', () => {
    const f = ruleW22(['grandmother', 'al-hadikhia', 'poisoner'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W22');
    expect(f.characters).toContain('al-hadikhia');
  });

  it('collects all loud Demons in one finding when multiple are on roster', () => {
    const f = ruleW22(['grandmother', 'leviathan', 'riot', 'poisoner'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.characters).toContain('grandmother');
    expect(f.characters).toContain('leviathan');
    expect(f.characters).toContain('riot');
  });
});

// ─── ruleW23 — Atheist wincon-rewriting ───────────────────────────────────────

describe('ruleW23 — Atheist wincon-rewriting role', () => {
  it('returns null when hasAtheist is false', () => {
    expect(ruleW23([], makeContext({ hasAtheist: false }), realCharById)).toBeNull();
  });

  it('returns a Finding when hasAtheist is true', () => {
    const f = ruleW23(['atheist', 'poisoner'], makeContext({ hasAtheist: true }), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W23');
    expect(f.severity).toBe('soft_warning');
    expect(f.type).toBe('script');
    expect(typeof f.notice_text).toBe('string');
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
  });
});

// ─── runRules integration ─────────────────────────────────────────────────────

describe('runRules — soft-warnings-29-40 group integration', () => {
  it('W21 fires into warnings when slayer and lleech are both on roster', () => {
    const roster = ['slayer', 'lleech', 'soldier', 'imp', 'poisoner'];
    const result = runRules(roster, realCharById, makeContext(), {});
    expect(result.warnings.some(f => f.rule_id === 'W21')).toBe(true);
  });

  it('W22 fires into warnings when grandmother + leviathan on roster', () => {
    const roster = ['grandmother', 'leviathan', 'poisoner'];
    const result = runRules(roster, realCharById, makeContext(), {});
    expect(result.warnings.some(f => f.rule_id === 'W22')).toBe(true);
  });

  it('W23 lands in notices (not warnings) when atheist_mode is auto-derived from hasAtheist: true', () => {
    const ctx = makeContext({ hasAtheist: true });
    const result = runRules(['soldier', 'imp', 'poisoner'], realCharById, ctx, {});
    expect(result.notices.some(f => f.rule_id === 'W23')).toBe(true);
    expect(result.warnings.some(f => f.rule_id === 'W23')).toBe(false);
  });

  it('W23 lands in warnings when atheist_mode: false is explicitly passed', () => {
    const ctx = makeContext({ hasAtheist: true });
    const result = runRules(['soldier', 'imp', 'poisoner'], realCharById, ctx, { atheist_mode: false });
    expect(result.warnings.some(f => f.rule_id === 'W23')).toBe(true);
    expect(result.notices.some(f => f.rule_id === 'W23')).toBe(false);
  });

  it('output is flat serialisable JSON (NFR9)', () => {
    const roster = ['slayer', 'lleech', 'grandmother', 'leviathan', 'soldier', 'poisoner'];
    const ctx = makeContext({ hasAtheist: true });
    const result = runRules(roster, realCharById, ctx, {});
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('clean case — no W21/W22/W23 notices when conditions are clear', () => {
    // no slayer/lleech pair, no grandmother, no atheist
    const ctx = makeContext({ hasAtheist: false });
    const result = runRules(['empath', 'chef', 'soldier', 'imp', 'poisoner'], realCharById, ctx, {});
    const targeted = result.warnings.filter(f => ['W21', 'W22', 'W23'].includes(f.rule_id));
    expect(targeted).toHaveLength(0);
  });
});
