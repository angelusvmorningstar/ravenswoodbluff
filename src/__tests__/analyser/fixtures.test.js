/**
 * Story 3.5 fixtures: full Finding-shape assertions for every hard error rule
 * and representative fixtures for each soft-warning thematic group.
 */
import { describe, it, expect } from 'vitest';
import {
  ruleE01, ruleE03, ruleE04, ruleE05, ruleE06, ruleE07, ruleE08, ruleE11,
  ruleW06, ruleW07, ruleW09, ruleW10, ruleW11, ruleW13,
  ruleW15, ruleW16, ruleW17, ruleW18, ruleW20, ruleW21, ruleW22, ruleW23,
  runRules,
} from '../../js/analyser.js';
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

// ── Shape assertion helper ───────────────────────────────────────────────────

function assertFindingShape(f, expectedRuleId, expectedSeverity, expectedType) {
  expect(f.rule_id).toBe(expectedRuleId);
  expect(f.severity).toBe(expectedSeverity);
  expect(f.type).toBe(expectedType);
  expect(Array.isArray(f.affected_characters)).toBe(true);
  expect(Array.isArray(f.missing_mitigations)).toBe(true);
  expect(typeof f.notice_text).toBe('string');
  expect(() => JSON.stringify(f)).not.toThrow();
}

// ── E01 ─────────────────────────────────────────────────────────────────────

describe('E01 — roster count checks (Finding shape)', () => {
  it('fires one script-type E01 Finding per failing constraint', () => {
    const ctx = makeContext({ townsfolkCount: 12 });
    const findings = ruleE01([], ctx, realCharById);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const f = findings.find(fi => fi.message.includes('Townsfolk'));
    assertFindingShape(f, 'E01', 'hard_error', 'script');
  });

  it('returns [] when all counts at minimum', () => {
    const ctx = makeContext({ townsfolkCount: 13, outsiderCount: 4, minionCount: 4, demonCount: 1 });
    expect(ruleE01([], ctx, realCharById)).toHaveLength(0);
  });

  it('fires all 4 findings independently when every count fails', () => {
    const ctx = makeContext({ townsfolkCount: 10, outsiderCount: 2, minionCount: 2, demonCount: 0 });
    expect(ruleE01([], ctx, realCharById)).toHaveLength(4);
  });
});

// ── E03 ─────────────────────────────────────────────────────────────────────

describe('E03 — no Outsider-count obfuscation (Finding shape)', () => {
  it('fires a script-type E03 Finding when hasOutsiderObfuscation is false', () => {
    const f = ruleE03([], makeContext({ hasOutsiderObfuscation: false }), realCharById);
    assertFindingShape(f, 'E03', 'hard_error', 'script');
  });

  it('returns null when hasOutsiderObfuscation is true', () => {
    expect(ruleE03([], makeContext({ hasOutsiderObfuscation: true }), realCharById)).toBeNull();
  });
});

// ── E04 ─────────────────────────────────────────────────────────────────────

describe('E04 — hate-jinx pair without Sentinel (Finding shape)', () => {
  it('fires a pair-type E04 Finding for heretic+baron without Sentinel', () => {
    const f = ruleE04(['heretic', 'baron', 'imp'], makeContext({ hasSentinel: false }), realCharById)[0];
    assertFindingShape(f, 'E04', 'hard_error', 'pair');
    expect(f.characters).toContain('heretic');
    expect(f.characters).toContain('baron');
    expect(f.affected_characters).toContain('heretic');
    expect(f.missing_mitigations).toContain('sentinel');
  });

  it('returns [] when Sentinel is present', () => {
    expect(ruleE04(['heretic', 'baron'], makeContext({ hasSentinel: true }), realCharById)).toHaveLength(0);
  });

  it('returns [] when only one of the pair is on script', () => {
    expect(ruleE04(['heretic', 'imp'], makeContext({ hasSentinel: false }), realCharById)).toHaveLength(0);
  });
});

// ── E05 ─────────────────────────────────────────────────────────────────────

describe('E05 — two+ strong extra-evil without Spirit of Ivory (Finding shape)', () => {
  it('fires a script-type E05 Finding when two strongEvil and no SoI', () => {
    const ctx = makeContext({ strongEvilRoles: ['bounty-hunter', 'mezepheles'], hasSpiritOfIvory: false });
    const f = ruleE05([], ctx, realCharById);
    assertFindingShape(f, 'E05', 'hard_error', 'script');
    expect(f.characters).toContain('bounty-hunter');
  });

  it('returns null when only one strongEvil role', () => {
    expect(ruleE05([], makeContext({ strongEvilRoles: ['bounty-hunter'] }), realCharById)).toBeNull();
  });

  it('returns null when two strongEvil but Spirit of Ivory is present', () => {
    const ctx = makeContext({ strongEvilRoles: ['bounty-hunter', 'mezepheles'], hasSpiritOfIvory: true });
    expect(ruleE05([], ctx, realCharById)).toBeNull();
  });
});

// ── E06 ─────────────────────────────────────────────────────────────────────

describe('E06 — single Minion telegraphed (Finding shape)', () => {
  it('fires a character-type E06 Finding when minionCount is 1', () => {
    const f = ruleE06(['empath', 'poisoner', 'imp'], makeContext({ minionCount: 1 }), realCharById);
    assertFindingShape(f, 'E06', 'hard_error', 'character');
    expect(f.characters).toContain('poisoner');
  });

  it('returns null when minionCount is not 1', () => {
    expect(ruleE06([], makeContext({ minionCount: 4 }), realCharById)).toBeNull();
  });
});

// ── E07 ─────────────────────────────────────────────────────────────────────

describe('E07 — Spirit of Ivory with no extra-evil (Finding shape)', () => {
  it('fires a script-type E07 Finding when SoI present and no extra-evil', () => {
    const f = ruleE07([], makeContext({ hasSpiritOfIvory: true, hasExtraEvil: false }), realCharById);
    assertFindingShape(f, 'E07', 'hard_error', 'script');
  });

  it('returns null when no Spirit of Ivory', () => {
    expect(ruleE07([], makeContext({ hasSpiritOfIvory: false }), realCharById)).toBeNull();
  });

  it('returns null when SoI present and extra-evil also present', () => {
    expect(ruleE07([], makeContext({ hasSpiritOfIvory: true, hasExtraEvil: true }), realCharById)).toBeNull();
  });
});

// ── E08 ─────────────────────────────────────────────────────────────────────

describe('E08 — hard-confirmation role with no proc-confounder (Finding shape)', () => {
  it('fires E08 for slayer with no proc-confounder on roster', () => {
    // slayer proc_confounders: spy, recluse, scarlet-woman, boffin
    const findings = ruleE08(['slayer', 'imp', 'chef'], makeContext(), realCharById);
    const f = findings.find(fi => fi.rule_id === 'E08' && fi.characters.includes('slayer'));
    expect(f).toBeDefined();
    assertFindingShape(f, 'E08', 'hard_error', 'character');
    expect(f.missing_mitigations).toContain('spy');
  });

  it('returns no E08 when full proc-confounder (spy) is on roster', () => {
    const findings = ruleE08(['slayer', 'spy', 'imp'], makeContext(), realCharById);
    expect(findings.filter(fi => fi.rule_id === 'E08' && fi.characters.includes('slayer'))).toHaveLength(0);
  });

  it('fires W14 (partial coverage) for fool when only lleech is on roster', () => {
    // fool proc_confounders: devils-advocate (full), lleech (partial), boffin (partial)
    const findings = ruleE08(['fool', 'lleech', 'imp'], makeContext(), realCharById);
    const w14 = findings.find(fi => fi.rule_id === 'W14' && fi.characters.includes('fool'));
    expect(w14).toBeDefined();
    expect(w14.severity).toBe('soft_warning');
  });

  it('returns [] when no hard-confirmation character on roster', () => {
    expect(ruleE08(['empath', 'chef', 'imp'], makeContext(), realCharById)).toHaveLength(0);
  });
});

// ── E11 ─────────────────────────────────────────────────────────────────────

describe('E11 — load-bearing soft confirmation with no claim-confounder (Finding shape)', () => {
  it('fires E11 for mayor with no claim-confounder on roster', () => {
    // mayor claim_confounders include: drunk, marionette, mezepheles, cerenovus, etc.
    const findings = ruleE11(['mayor', 'imp', 'chef'], makeContext(), realCharById);
    const f = findings.find(fi => fi.rule_id === 'E11' && fi.characters.includes('mayor'));
    expect(f).toBeDefined();
    assertFindingShape(f, 'E11', 'hard_error', 'character');
    expect(f.missing_mitigations).toContain('drunk');
  });

  it('returns no E11 when claim-confounder (drunk) is on roster', () => {
    const findings = ruleE11(['mayor', 'drunk', 'imp'], makeContext(), realCharById);
    expect(findings.filter(fi => fi.characters.includes('mayor'))).toHaveLength(0);
  });

  it('returns [] when no load-bearing-soft character on roster', () => {
    expect(ruleE11(['empath', 'chef', 'imp'], makeContext(), realCharById)).toHaveLength(0);
  });
});

// ── Soft-warning group fixtures ──────────────────────────────────────────────

describe('Group A — Script composition counts', () => {
  it('W06: fires when townsfolkCount > 7 and droizonDensity < 2', () => {
    const f = ruleW06([], makeContext({ townsfolkCount: 8, droizonDensity: 1 }), realCharById);
    expect(f?.rule_id).toBe('W06');
  });

  it('W06: returns null when townsfolkCount <= 7', () => {
    expect(ruleW06([], makeContext({ townsfolkCount: 7, droizonDensity: 1 }), realCharById)).toBeNull();
  });

  it('W07: fires when droizonDensity > 4', () => {
    expect(ruleW07([], makeContext({ droizonDensity: 5 }), realCharById)?.rule_id).toBe('W07');
  });

  it('W07: returns null when droizonDensity <= 4', () => {
    expect(ruleW07([], makeContext({ droizonDensity: 4 }), realCharById)).toBeNull();
  });
});

describe('Group B — Role interaction warnings', () => {
  it('W09: fires when loud (leviathan) and quiet (imp) demons are both on roster', () => {
    const f = ruleW09(['leviathan', 'imp', 'poisoner'], makeContext(), realCharById);
    expect(f?.rule_id).toBe('W09');
  });

  it('W15: fires when boffin + 3 hard-confirmation roles on roster', () => {
    const f = ruleW15(['boffin', 'fool', 'slayer', 'virgin', 'imp'], makeContext(), realCharById);
    expect(f?.rule_id).toBe('W15');
    expect(f?.characters).toContain('boffin');
  });

  it('W15: returns null when boffin + only 2 hard-confirmation roles (below threshold)', () => {
    expect(ruleW15(['boffin', 'fool', 'slayer', 'imp'], makeContext(), realCharById)).toBeNull();
  });
});

describe('Group C — Specific role flags', () => {
  it('W10: fires (array) for vortox on roster', () => {
    const findings = ruleW10(['vortox', 'imp'], makeContext(), realCharById);
    expect(findings.some(f => f.rule_id === 'W10' && f.characters.includes('vortox'))).toBe(true);
  });

  it('W10: returns [] when no vortoxFlag chars on roster', () => {
    expect(ruleW10(['empath', 'imp'], makeContext(), realCharById)).toHaveLength(0);
  });

  it('W11: fires for mathematician + 3 misinfo chars of mixed shapes', () => {
    // poisoner=arbitrary, drunk=persistent-column, widow=targeted
    const f = ruleW11(['mathematician', 'poisoner', 'drunk', 'widow', 'imp'], makeContext(), realCharById);
    expect(f?.rule_id).toBe('W11');
  });

  it('W13: fires when recluse (misregistration) + artist (nonconformistInfo) on roster', () => {
    const f = ruleW13(['recluse', 'artist', 'imp'], makeContext(), realCharById);
    expect(f?.rule_id).toBe('W13');
  });
});

describe('Group D — Structural/pacing', () => {
  it('W16: fires when mayor + bounce-confounder but no claim-confounder', () => {
    const f = ruleW16(['mayor', 'lunatic', 'imp'], makeContext(), realCharById);
    expect(f?.rule_id).toBe('W16');
  });

  it('W16: returns null when claim-confounder (drunk) is present', () => {
    expect(ruleW16(['mayor', 'drunk', 'lunatic', 'imp'], makeContext(), realCharById)).toBeNull();
  });

  it('W16: returns null when neither lunatic nor magician is on roster', () => {
    expect(ruleW16(['mayor', 'imp', 'poisoner'], makeContext(), realCharById)).toBeNull();
  });

  it('W16: fires when mayor + magician (alternative bounce-confounder) with no claim-confounder', () => {
    expect(ruleW16(['mayor', 'magician', 'imp'], makeContext(), realCharById)?.rule_id).toBe('W16');
  });

  it('W17: fires when quiet Demon present without night-protection', () => {
    const f = ruleW17(['imp', 'poisoner', 'chef'], makeContext(), realCharById);
    expect(f?.rule_id).toBe('W17');
  });

  it('W17: returns null when soldier (night-protection) is on roster', () => {
    expect(ruleW17(['imp', 'soldier', 'poisoner'], makeContext(), realCharById)).toBeNull();
  });

  it('W18: fires when jinxCount > 5', () => {
    expect(ruleW18([], makeContext({ jinxCount: 6 }), realCharById)?.rule_id).toBe('W18');
  });

  it('W20: fires when 2+ confirmation cluster and no certainty-underminer', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer', 'virgin']) });
    expect(ruleW20(['slayer', 'virgin', 'imp'], ctx, realCharById)?.rule_id).toBe('W20');
  });
});

describe('Group E — Late additions (W21–W23)', () => {
  it('W21: fires when slayer and lleech are both on roster', () => {
    expect(ruleW21(['slayer', 'lleech', 'imp'], makeContext(), realCharById)?.rule_id).toBe('W21');
  });

  it('W21: returns null when only slayer is on roster', () => {
    expect(ruleW21(['slayer', 'imp'], makeContext(), realCharById)).toBeNull();
  });

  it('W22: fires when grandmother + leviathan (loud demon) on roster', () => {
    expect(ruleW22(['grandmother', 'leviathan', 'poisoner'], makeContext(), realCharById)?.rule_id).toBe('W22');
  });

  it('W22: returns null when no loud demon alongside grandmother', () => {
    expect(ruleW22(['grandmother', 'imp', 'poisoner'], makeContext(), realCharById)).toBeNull();
  });

  it('W23: fires when hasAtheist is true', () => {
    expect(ruleW23([], makeContext({ hasAtheist: true }), realCharById)?.rule_id).toBe('W23');
  });

  it('W23: returns null when hasAtheist is false', () => {
    expect(ruleW23([], makeContext({ hasAtheist: false }), realCharById)).toBeNull();
  });
});

// ── Integration — well-formed script produces no errors or warnings ──────────

describe('runRules integration — well-formed script', () => {
  it('errors and warnings are both empty for a clean well-formed context', () => {
    const ctx = makeContext({
      townsfolkCount: 13, outsiderCount: 4, minionCount: 4, demonCount: 1,
      droizonDensity: 2, hasOutsiderObfuscation: true, hasExtraEvil: false,
      strongEvilRoles: [], hasSentinel: false, hasSpiritOfIvory: false,
      hasHeretic: false, hasAtheist: false, jinxCount: 3,
      minionVolumeScore: { min: 1, max: 2, spread: 1, tiers: [] },
      confirmationCluster: new Set(),
    });
    // leviathan (loud, in MULTI_KILL) prevents W17; no quiet demon on roster
    const roster = ['empath', 'chef', 'leviathan', 'poisoner'];
    const result = runRules(roster, realCharById, ctx, {});
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('output is flat serialisable JSON (NFR9)', () => {
    const ctx = makeContext({ townsfolkCount: 0, demonCount: 0, hasOutsiderObfuscation: false });
    const result = runRules([], realCharById, ctx, {});
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
