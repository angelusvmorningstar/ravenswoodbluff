import { describe, it, expect } from 'vitest';
import { ruleN86, ruleN87, ruleN88, ruleN106, runRules } from '../../js/analyser.js';
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

const ROSTER = ['empath', 'chef', 'imp', 'poisoner'];

describe('ruleN86 — loud Demon notice (array output)', () => {
  it('returns [] when no loud-Demon character in roster', () => {
    expect(ruleN86(ROSTER, makeContext(), realCharById)).toEqual([]);
  });

  it('returns [] when imp is in roster (imp is not loud-Demon)', () => {
    const findings = ruleN86(['imp', 'chef', 'empath'], makeContext(), realCharById);
    expect(findings).toEqual([]);
  });

  it('returns one Finding when leviathan is in roster', () => {
    const findings = ruleN86(['leviathan', 'poisoner', 'empath'], makeContext(), realCharById);
    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.rule_id).toBe('N86');
    expect(f.severity).toBe('informational');
    expect(f.type).toBe('character');
    expect(f.characters).toContain('leviathan');
    expect(f.affected_characters).toContain('leviathan');
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
  });

  it('returns one Finding when riot is in roster', () => {
    const findings = ruleN86(['riot', 'poisoner', 'empath'], makeContext(), realCharById);
    expect(findings).toHaveLength(1);
    expect(findings[0].characters).toContain('riot');
  });

  it('returns two Findings when leviathan and riot both in roster', () => {
    const findings = ruleN86(['leviathan', 'riot', 'poisoner'], makeContext(), realCharById);
    expect(findings).toHaveLength(2);
    const ids = findings.map(f => f.characters[0]).sort();
    expect(ids).toEqual(['leviathan', 'riot'].sort());
  });

  it('returns one Finding when al-hadikhia is in roster', () => {
    const findings = ruleN86(['al-hadikhia', 'poisoner', 'empath'], makeContext(), realCharById);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule_id).toBe('N86');
    expect(findings[0].characters).toContain('al-hadikhia');
  });

  it('returns three Findings when all three loud Demons are on roster', () => {
    const findings = ruleN86(['al-hadikhia', 'leviathan', 'riot', 'poisoner'], makeContext(), realCharById);
    expect(findings).toHaveLength(3);
    const ids = findings.flatMap(f => f.characters).sort();
    expect(ids).toContain('al-hadikhia');
    expect(ids).toContain('leviathan');
    expect(ids).toContain('riot');
  });
});

describe('ruleN87 — execution contingency notice', () => {
  it('returns null when no execution-contingency character in roster', () => {
    const roster = ['leviathan', 'poisoner', 'empath', 'chef'];
    expect(ruleN87(roster, makeContext(), realCharById)).toBeNull();
  });

  it('returns null when only imp is in roster (Imp self-kill is not an execution contingency)', () => {
    expect(ruleN87(['imp', 'poisoner', 'empath'], makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when scarlet-woman is in roster', () => {
    const roster = ['leviathan', 'scarlet-woman', 'empath'];
    const f = ruleN87(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N87');
    expect(f.severity).toBe('informational');
    expect(f.type).toBe('script');
    expect(f.characters).toContain('scarlet-woman');
    expect(f.affected_characters).toContain('scarlet-woman');
    expect(typeof f.notice_text).toBe('string');
  });

  it('returns a Finding when evil-twin is in roster', () => {
    const roster = ['leviathan', 'evil-twin', 'empath'];
    const f = ruleN87(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N87');
    expect(f.characters).toContain('evil-twin');
  });

  it('returns a Finding when mastermind is in roster', () => {
    const roster = ['leviathan', 'mastermind', 'empath'];
    const f = ruleN87(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N87');
    expect(f.characters).toContain('mastermind');
  });

  it('returns a Finding when zombuul is in roster (deadCanBeEvil)', () => {
    const roster = ['zombuul', 'poisoner', 'empath'];
    const f = ruleN87(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N87');
    expect(f.characters).toContain('zombuul');
  });

  it('returns a Finding when fang-gu is in roster (deadCanBeEvil — role-jump leaves apparent dead Demon)', () => {
    const roster = ['fang-gu', 'poisoner', 'empath'];
    const f = ruleN87(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N87');
    expect(f.characters).toContain('fang-gu');
  });

  it('returns null when vigormortis is in roster (deadCanBeEvil refers to dead Minions, not execution contingency)', () => {
    const roster = ['vigormortis', 'poisoner', 'empath'];
    expect(ruleN87(roster, makeContext(), realCharById)).toBeNull();
  });

  it('returns null when lleech is in roster (execution deflection, not contingency; covered by N106)', () => {
    const roster = ['lleech', 'poisoner', 'empath'];
    expect(ruleN87(roster, makeContext(), realCharById)).toBeNull();
  });
});

describe('ruleN106 — execution blocker notice', () => {
  it('returns null when no execution-blocker character in roster', () => {
    const roster = ['leviathan', 'poisoner', 'empath', 'chef'];
    expect(ruleN106(roster, makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when devils-advocate is in roster', () => {
    const roster = ['leviathan', 'devils-advocate', 'empath'];
    const f = ruleN106(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N106');
    expect(f.severity).toBe('informational');
    expect(f.type).toBe('script');
    expect(f.characters).toContain('devils-advocate');
    expect(typeof f.notice_text).toBe('string');
  });

  it('returns a Finding when lleech is in roster', () => {
    const roster = ['lleech', 'poisoner', 'empath'];
    const f = ruleN106(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N106');
    expect(f.characters).toContain('lleech');
  });

  it('returns a Finding when organ-grinder is in roster', () => {
    const roster = ['leviathan', 'organ-grinder', 'empath'];
    const f = ruleN106(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N106');
    expect(f.characters).toContain('organ-grinder');
  });

  it('returns a Finding when vizier is in roster', () => {
    const roster = ['leviathan', 'vizier', 'empath'];
    const f = ruleN106(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N106');
    expect(f.characters).toContain('vizier');
  });

  it('collects all blocker characters in one finding', () => {
    const roster = ['lleech', 'devils-advocate', 'vizier', 'empath'];
    const f = ruleN106(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.characters).toContain('lleech');
    expect(f.characters).toContain('devils-advocate');
    expect(f.characters).toContain('vizier');
  });
});

describe('ruleN88 — Vortox global false-info regime', () => {
  it('returns null when vortox is not in roster', () => {
    expect(ruleN88(ROSTER, makeContext(), realCharById)).toBeNull();
  });

  it('returns null when atheist is in roster but vortox is not', () => {
    expect(ruleN88(['atheist', 'poisoner', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when vortox is in roster', () => {
    const f = ruleN88(['vortox', 'poisoner', 'empath'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N88');
    expect(f.severity).toBe('informational');
    expect(f.type).toBe('character');
    expect(f.characters).toContain('vortox');
    expect(f.affected_characters).toContain('vortox');
    expect(typeof f.notice_text).toBe('string');
  });
});

describe('runRules — demon/misc group integration', () => {
  it('N86 fires into notices when leviathan on roster', () => {
    const roster = ['leviathan', 'poisoner', 'empath'];
    const result = runRules(roster, realCharById, makeContext({ demonCount: 1 }), {});
    expect(result.notices.some(f => f.rule_id === 'N86')).toBe(true);
  });

  it('N87 fires into notices when scarlet-woman on roster', () => {
    const roster = ['leviathan', 'scarlet-woman', 'empath'];
    const result = runRules(roster, realCharById, makeContext({ demonCount: 1 }), {});
    expect(result.notices.some(f => f.rule_id === 'N87')).toBe(true);
  });

  it('N88 fires into notices when vortox on roster', () => {
    const roster = ['vortox', 'poisoner', 'empath'];
    const result = runRules(roster, realCharById, makeContext({ demonCount: 1 }), {});
    expect(result.notices.some(f => f.rule_id === 'N88')).toBe(true);
  });

  it('output is flat serialisable JSON (NFR9)', () => {
    const roster = ['leviathan', 'vortox', 'poisoner'];
    const result = runRules(roster, realCharById, makeContext({ demonCount: 1 }), {});
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('clean case — no N86/N87/N88/N106 notices for standard imp roster', () => {
    // imp is not loudDemon (N86 empty); imp self-kill excluded from contingency (N87 null);
    // no vortox (N88 null); no blockers in base roster (N106 null)
    const ctx = makeContext({ droizonDensity: 2, demonCount: 1 });
    const result = runRules(ROSTER, realCharById, ctx, {});
    const demonRules = result.notices.filter(f => ['N86', 'N87', 'N88', 'N106'].includes(f.rule_id));
    expect(demonRules).toHaveLength(0);
  });
});
