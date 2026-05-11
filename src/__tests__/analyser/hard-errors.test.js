import { describe, it, expect } from 'vitest';
import {
  ruleE01, ruleE03, ruleE04, ruleE05, ruleE06, ruleE07, ruleE08, ruleE11,
  runRules, buildScriptContext,
} from '../../js/analyser.js';
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

// ─── ruleE01 ─────────────────────────────────────────────────────────────────

describe('ruleE01 — roster count checks', () => {
  it('returns [] when all counts pass', () => {
    const ctx = makeContext({ townsfolkCount: 13, outsiderCount: 4, minionCount: 4, demonCount: 1 });
    expect(ruleE01([], ctx, charById)).toHaveLength(0);
  });

  it('fires for too few Townsfolk', () => {
    const ctx = makeContext({ townsfolkCount: 12 });
    const fs = ruleE01([], ctx, charById);
    expect(fs.some(f => f.rule_id === 'E01' && f.message.includes('Townsfolk'))).toBe(true);
  });

  it('fires for too few Outsiders', () => {
    const ctx = makeContext({ outsiderCount: 3 });
    const fs = ruleE01([], ctx, charById);
    expect(fs.some(f => f.rule_id === 'E01' && f.message.includes('Outsider'))).toBe(true);
  });

  it('fires for too few Minions', () => {
    const ctx = makeContext({ minionCount: 3 });
    const fs = ruleE01([], ctx, charById);
    expect(fs.some(f => f.rule_id === 'E01' && f.message.includes('Minion'))).toBe(true);
  });

  it('fires for no Demon', () => {
    const ctx = makeContext({ demonCount: 0 });
    const fs = ruleE01([], ctx, charById);
    expect(fs.some(f => f.rule_id === 'E01' && f.message.includes('Demon'))).toBe(true);
  });

  it('fires multiple findings independently', () => {
    const ctx = makeContext({ townsfolkCount: 10, outsiderCount: 2, minionCount: 2, demonCount: 0 });
    expect(ruleE01([], ctx, charById)).toHaveLength(4);
  });

  it('each finding has required v2.1 schema fields', () => {
    const ctx = makeContext({ demonCount: 0 });
    const [f] = ruleE01([], ctx, charById);
    expect(f.rule_id).toBe('E01');
    expect(f.severity).toBe('hard_error');
    expect(f.type).toBe('script');
    expect(typeof f.notice_text).toBe('string');
    expect(typeof f.explainer_text).toBe('string');
    expect(Array.isArray(f.affected_characters)).toBe(true);
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
  });
});

// ─── ruleE03 ─────────────────────────────────────────────────────────────────

describe('ruleE03 — no Outsider-count obfuscation', () => {
  it('returns null when hasOutsiderObfuscation is true', () => {
    expect(ruleE03([], makeContext({ hasOutsiderObfuscation: true }), charById)).toBeNull();
  });

  it('fires when hasOutsiderObfuscation is false', () => {
    const f = ruleE03([], makeContext({ hasOutsiderObfuscation: false }), charById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('E03');
    expect(f.severity).toBe('hard_error');
    expect(f.type).toBe('script');
  });
});

// ─── ruleE04 ─────────────────────────────────────────────────────────────────

describe('ruleE04 — hate-jinx pair without Sentinel', () => {
  it('returns [] when Sentinel is present', () => {
    const ctx = makeContext({ hasSentinel: true });
    expect(ruleE04(['heretic', 'baron'], ctx, charById)).toHaveLength(0);
  });

  it('fires for heretic+baron with no Sentinel', () => {
    const ctx = makeContext({ hasSentinel: false });
    const fs = ruleE04(['heretic', 'baron'], ctx, charById);
    expect(fs).toHaveLength(1);
    expect(fs[0].rule_id).toBe('E04');
    expect(fs[0].severity).toBe('hard_error');
    expect(fs[0].type).toBe('pair');
    expect(fs[0].affected_characters).toContain('heretic');
    expect(fs[0].affected_characters).toContain('baron');
  });

  it('fires for heretic+spy with no Sentinel', () => {
    const ctx = makeContext({ hasSentinel: false });
    const fs = ruleE04(['heretic', 'spy'], ctx, charById);
    expect(fs).toHaveLength(1);
    expect(fs[0].rule_id).toBe('E04');
  });

  it('returns [] when only one of the hate pair is on script', () => {
    const ctx = makeContext({ hasSentinel: false });
    expect(ruleE04(['heretic'], ctx, charById)).toHaveLength(0);
    expect(ruleE04(['baron'], ctx, charById)).toHaveLength(0);
  });

  it('returns [] for a non-hate pair even without Sentinel', () => {
    const ctx = makeContext({ hasSentinel: false });
    expect(ruleE04(['alchemist', 'boffin'], ctx, charById)).toHaveLength(0);
  });
});

// ─── ruleE05 ─────────────────────────────────────────────────────────────────

describe('ruleE05 — two+ strong extra-evil without Spirit of Ivory', () => {
  it('returns null when fewer than 2 strong evil roles', () => {
    const ctx = makeContext({ strongEvilRoles: ['godfather'] });
    expect(ruleE05([], ctx, charById)).toBeNull();
  });

  it('returns null when 2 strong evil roles but Spirit of Ivory present', () => {
    const ctx = makeContext({ strongEvilRoles: ['godfather', 'witch'], hasSpiritOfIvory: true });
    expect(ruleE05([], ctx, charById)).toBeNull();
  });

  it('fires when 2+ strong evil roles and no Spirit of Ivory', () => {
    const ctx = makeContext({ strongEvilRoles: ['godfather', 'witch'], hasSpiritOfIvory: false });
    const f = ruleE05([], ctx, charById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('E05');
    expect(f.severity).toBe('hard_error');
    expect(f.type).toBe('script');
    expect(f.characters).toContain('godfather');
    expect(f.characters).toContain('witch');
  });
});

// ─── ruleE06 ─────────────────────────────────────────────────────────────────

describe('ruleE06 — single Minion telegraphed', () => {
  it('returns null when minionCount !== 1', () => {
    expect(ruleE06([], makeContext({ minionCount: 4 }), charById)).toBeNull();
    expect(ruleE06([], makeContext({ minionCount: 0 }), charById)).toBeNull();
  });

  it('fires when minionCount === 1 and identifies the minion', () => {
    const roster = ['empath', 'poisoner', 'imp'];
    const f = ruleE06(roster, makeContext({ minionCount: 1 }), charById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('E06');
    expect(f.severity).toBe('hard_error');
    expect(f.type).toBe('character');
    expect(f.characters).toContain('poisoner');
  });
});

// ─── ruleE07 ─────────────────────────────────────────────────────────────────

describe('ruleE07 — Spirit of Ivory with no extra-evil', () => {
  it('returns null when Spirit of Ivory not on script', () => {
    expect(ruleE07([], makeContext({ hasSpiritOfIvory: false }), charById)).toBeNull();
  });

  it('returns null when Spirit of Ivory AND extra-evil present', () => {
    const ctx = makeContext({ hasSpiritOfIvory: true, hasExtraEvil: true });
    expect(ruleE07([], ctx, charById)).toBeNull();
  });

  it('fires when Spirit of Ivory present and no extra-evil', () => {
    const ctx = makeContext({ hasSpiritOfIvory: true, hasExtraEvil: false });
    const f = ruleE07([], ctx, charById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('E07');
    expect(f.severity).toBe('hard_error');
    expect(f.type).toBe('script');
  });
});

// ─── ruleE08 ─────────────────────────────────────────────────────────────────

describe('ruleE08 — hard-confirmation role with no proc-confounder', () => {
  // fool has proc_confounders: [devils-advocate (full), lleech (partial), boffin (partial)]
  it('fires E08 for fool with no proc-confounder on roster', () => {
    const roster = ['fool', 'imp', 'poisoner'];
    const fs = ruleE08(roster, makeContext(), charById);
    expect(fs.some(f => f.rule_id === 'E08' && f.characters.includes('fool'))).toBe(true);
  });

  it('fires W14 for fool when only partial proc-confounder (lleech) is on roster', () => {
    const roster = ['fool', 'imp', 'poisoner', 'lleech'];
    const fs = ruleE08(roster, makeContext(), charById);
    expect(fs.some(f => f.rule_id === 'W14' && f.characters.includes('fool'))).toBe(true);
    expect(fs.some(f => f.rule_id === 'E08' && f.characters.includes('fool'))).toBe(false);
  });

  it('fires no finding for fool when full proc-confounder (devils-advocate) is on roster', () => {
    const roster = ['fool', 'imp', 'poisoner', 'devils-advocate'];
    const fs = ruleE08(roster, makeContext(), charById);
    const foolFindings = fs.filter(f => f.characters.includes('fool'));
    expect(foolFindings).toHaveLength(0);
  });

  it('returns [] for a roster with no hard-confirmation characters', () => {
    const roster = ['empath', 'chef', 'imp', 'poisoner'];
    expect(ruleE08(roster, makeContext(), charById)).toHaveLength(0);
  });

  it('includes missing_mitigations listing proc-confounder ids', () => {
    const roster = ['fool', 'imp', 'poisoner'];
    const fs = ruleE08(roster, makeContext(), charById);
    const foolFinding = fs.find(f => f.rule_id === 'E08' && f.characters.includes('fool'));
    expect(foolFinding.missing_mitigations).toContain('devils-advocate');
  });

  it('W14 partial finding lists only absent proc-confounders in missing_mitigations', () => {
    // fool + lleech: lleech is partial confounder and is present → W14; missing = devils-advocate + boffin
    const roster = ['fool', 'imp', 'poisoner', 'lleech'];
    const fs = ruleE08(roster, makeContext(), charById);
    const w14 = fs.find(f => f.rule_id === 'W14' && f.characters.includes('fool'));
    expect(w14.missing_mitigations).toContain('devils-advocate');
    expect(w14.missing_mitigations).toContain('boffin');
    expect(w14.missing_mitigations).not.toContain('lleech');
  });

  it('fires E08 for fool and W14 for virgin when both on roster with no confounders', () => {
    const roster = ['fool', 'virgin', 'imp', 'poisoner'];
    const fs = ruleE08(roster, makeContext(), charById);
    expect(fs.some(f => f.rule_id === 'E08' && f.characters.includes('fool'))).toBe(true);
    expect(fs.some(f => f.rule_id === 'W14' && f.characters.includes('virgin'))).toBe(true);
  });

  it('fires E08 for sailor with no proc-confounder on roster', () => {
    const roster = ['sailor', 'imp', 'poisoner'];
    const fs = ruleE08(roster, makeContext(), charById);
    expect(fs.some(f => f.rule_id === 'E08' && f.characters.includes('sailor'))).toBe(true);
  });
});

// ─── ruleE08 — W14 severity path (virgin) ────────────────────────────────────

describe('ruleE08 — W14 severity via confirmation.severity=soft_warning (virgin)', () => {
  // virgin has severity: "soft_warning" on its hard confirmation, so it emits W14 not E08
  it('fires W14 (not E08) for virgin with no proc-confounder on roster', () => {
    const roster = ['virgin', 'imp', 'poisoner'];
    const fs = ruleE08(roster, makeContext(), charById);
    expect(fs.some(f => f.rule_id === 'W14' && f.characters.includes('virgin'))).toBe(true);
    expect(fs.some(f => f.rule_id === 'E08' && f.characters.includes('virgin'))).toBe(false);
  });

  it('suppresses W14 for virgin when spy (full proc-confounder) is on roster', () => {
    const roster = ['virgin', 'imp', 'poisoner', 'spy'];
    const fs = ruleE08(roster, makeContext(), charById);
    expect(fs.filter(f => f.characters.includes('virgin'))).toHaveLength(0);
  });

  it('suppresses W14 for virgin when marionette (full proc-confounder) is on roster', () => {
    const roster = ['virgin', 'imp', 'poisoner', 'marionette'];
    const fs = ruleE08(roster, makeContext(), charById);
    expect(fs.filter(f => f.characters.includes('virgin'))).toHaveLength(0);
  });

  it('fires W14 for virgin when only boffin (partial) is on roster', () => {
    const roster = ['virgin', 'imp', 'poisoner', 'boffin'];
    const fs = ruleE08(roster, makeContext(), charById);
    expect(fs.some(f => f.rule_id === 'W14' && f.characters.includes('virgin'))).toBe(true);
  });
});

// ─── ruleE11 ─────────────────────────────────────────────────────────────────

describe('ruleE11 — load-bearing soft confirmation with no claim-confounder', () => {
  // mayor has claim_confounders: [drunk (full), marionette (full), ...]
  it('fires E11 for mayor with no claim-confounder on roster', () => {
    const roster = ['mayor', 'imp', 'poisoner'];
    const fs = ruleE11(roster, makeContext(), charById);
    expect(fs.some(f => f.rule_id === 'E11' && f.characters.includes('mayor'))).toBe(true);
  });

  it('fires no finding for mayor when claim-confounder (drunk) is on roster', () => {
    const roster = ['mayor', 'imp', 'poisoner', 'drunk'];
    const fs = ruleE11(roster, makeContext(), charById);
    expect(fs.filter(f => f.characters.includes('mayor'))).toHaveLength(0);
  });

  it('returns [] for a roster with no load-bearing-soft characters', () => {
    const roster = ['empath', 'chef', 'imp', 'poisoner'];
    expect(ruleE11(roster, makeContext(), charById)).toHaveLength(0);
  });

  it('E11 finding includes absent claim-confounders in missing_mitigations', () => {
    const roster = ['mayor', 'imp', 'poisoner'];
    const fs = ruleE11(roster, makeContext(), charById);
    const e11 = fs.find(f => f.rule_id === 'E11' && f.characters.includes('mayor'));
    expect(e11.missing_mitigations).toContain('drunk');
    expect(e11.missing_mitigations).toContain('marionette');
  });
});

// ─── buildScriptContext new fields ───────────────────────────────────────────

describe('buildScriptContext — new fields (Story 3.1)', () => {
  it('hasOutsiderObfuscation is true when oMod character on roster', () => {
    const baronId = 'baron'; // baron has lint.oMod
    const ctx = buildScriptContext([baronId], charById);
    expect(ctx.hasOutsiderObfuscation).toBe(true);
  });

  it('hasOutsiderObfuscation is false for roster with no oMod/oHide characters', () => {
    const ctx = buildScriptContext(['empath'], charById);
    expect(ctx.hasOutsiderObfuscation).toBe(false);
  });

  it('hasExtraEvil is true when extraEvil character on roster', () => {
    // bounty-hunter has lint.extraEvil === 'strong'
    const ctx = buildScriptContext(['bounty-hunter'], charById);
    expect(ctx.hasExtraEvil).toBe(true);
  });

  it('strongEvilRoles contains ids of lint.extraEvil === "strong" characters', () => {
    const ctx = buildScriptContext(['bounty-hunter', 'mezepheles'], charById);
    expect(Array.isArray(ctx.strongEvilRoles)).toBe(true);
    expect(ctx.strongEvilRoles).toContain('bounty-hunter');
    expect(ctx.strongEvilRoles).toContain('mezepheles');
  });
});

// ─── runRules integration ─────────────────────────────────────────────────────

describe('runRules — E-rule integration', () => {
  it('E01 fires into errors when roster counts are low', () => {
    const roster = ['empath', 'imp', 'poisoner'];
    const ctx = makeContext({ townsfolkCount: 1, outsiderCount: 0, minionCount: 1, demonCount: 1 });
    const result = runRules(roster, charById, ctx, {});
    expect(result.errors.some(f => f.rule_id === 'E01')).toBe(true);
  });

  it('E03 fires into errors when hasOutsiderObfuscation is false', () => {
    const ctx = makeContext({ hasOutsiderObfuscation: false });
    const result = runRules(['empath', 'imp', 'poisoner'], charById, ctx, {});
    expect(result.errors.some(f => f.rule_id === 'E03')).toBe(true);
  });

  it('E04 fires into errors for hate pair without Sentinel', () => {
    const ctx = makeContext({ hasHeretic: true, hasSentinel: false });
    const result = runRules(['heretic', 'baron', 'imp', 'poisoner'], charById, ctx, {});
    expect(result.errors.some(f => f.rule_id === 'E04')).toBe(true);
  });

  it('E04 does not fire when Sentinel is on script', () => {
    const ctx = makeContext({ hasHeretic: true, hasSentinel: true });
    const result = runRules(['heretic', 'baron', 'imp', 'poisoner'], charById, ctx, {});
    expect(result.errors.some(f => f.rule_id === 'E04')).toBe(false);
  });

  it('atheist_mode degrades E01 hard_error to soft_warning', () => {
    const ctx = makeContext({ demonCount: 0 });
    const result = runRules([], charById, ctx, { atheist_mode: true });
    expect(result.errors.some(f => f.rule_id === 'E01')).toBe(false);
    expect(result.warnings.some(f => f.rule_id === 'E01')).toBe(true);
  });

  it('output is flat serialisable JSON (NFR9)', () => {
    const ctx = makeContext({ demonCount: 0, hasOutsiderObfuscation: false });
    const result = runRules([], charById, ctx, {});
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('clean case — all counts passing, no E-rules fire', () => {
    const ctx = makeContext({
      townsfolkCount: 13, outsiderCount: 4, minionCount: 4, demonCount: 1,
      droizonDensity: 2, hasOutsiderObfuscation: true,
      hasExtraEvil: false, strongEvilRoles: [],
      hasHeretic: false, hasSentinel: false, hasSpiritOfIvory: false,
      jinxCount: 0,
    });
    // soldier provides night protection so W17 does not fire alongside imp
    const result = runRules(['empath', 'chef', 'soldier', 'imp', 'poisoner'], charById, ctx, {});
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.notices).toHaveLength(0);
  });
});
