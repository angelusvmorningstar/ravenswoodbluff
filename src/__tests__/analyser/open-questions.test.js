import { describe, it, expect } from 'vitest';
import { ruleOpenQuestions, runRules } from '../../js/analyser.js';
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

// ─── OQ 22.1 — tea-lady trigger ──────────────────────────────────────────────

describe('ruleOpenQuestions — OQ 22.1 (tea-lady)', () => {
  it('fires OQ-22.1 when tea-lady is on roster', () => {
    const findings = ruleOpenQuestions(['tea-lady', 'imp', 'chef'], realCharById, makeContext());
    const oq = findings.find(f => f.rule_id === 'OQ-22.1');
    expect(oq).toBeDefined();
    expect(oq.severity).toBe('informational');
    expect(oq.type).toBe('character');
    expect(oq.notice_text).toBe('Open Question 22.1');
    expect(typeof oq.explainer_text).toBe('string');
    expect(oq.explainer_text.length).toBeGreaterThan(0);
    expect(() => JSON.stringify(oq)).not.toThrow();
  });

  it('does not fire OQ-22.1 when tea-lady is absent', () => {
    const findings = ruleOpenQuestions(['empath', 'imp', 'chef'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.1')).toBe(false);
  });
});

// ─── OQ 22.2 — cross_group: exec-survival role + lleech ──────────────────────

describe('ruleOpenQuestions — OQ 22.2 (lleech + exec-survival group)', () => {
  it('fires OQ-22.2 when tea-lady + lleech are on roster', () => {
    const findings = ruleOpenQuestions(['tea-lady', 'lleech', 'imp'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.2')).toBe(true);
  });

  it('fires OQ-22.2 when fool + lleech are on roster', () => {
    const findings = ruleOpenQuestions(['fool', 'lleech', 'imp'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.2')).toBe(true);
  });

  it('fires OQ-22.2 when sailor + lleech are on roster', () => {
    const findings = ruleOpenQuestions(['sailor', 'lleech', 'imp'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.2')).toBe(true);
  });

  it('does not fire OQ-22.2 when lleech is absent', () => {
    const findings = ruleOpenQuestions(['tea-lady', 'fool', 'imp'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.2')).toBe(false);
  });

  it('does not fire OQ-22.2 when only lleech (no exec-survival group member) on roster', () => {
    // lleech has no open_questions entry — won't even be iterated
    const findings = ruleOpenQuestions(['lleech', 'imp', 'chef'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.2')).toBe(false);
  });
});

// ─── OQ 22.3 — boffin trigger ────────────────────────────────────────────────

describe('ruleOpenQuestions — OQ 22.3 (boffin)', () => {
  it('fires OQ-22.3 when boffin is on roster', () => {
    const findings = ruleOpenQuestions(['boffin', 'imp', 'chef'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.3')).toBe(true);
  });

  it('does not fire OQ-22.3 when boffin is absent', () => {
    const findings = ruleOpenQuestions(['empath', 'imp', 'chef'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.3')).toBe(false);
  });
});

// ─── OQ 22.4 — all_on_script: slayer + boffin ────────────────────────────────

describe('ruleOpenQuestions — OQ 22.4 (slayer + boffin)', () => {
  it('fires OQ-22.4 when both slayer and boffin are on roster', () => {
    const findings = ruleOpenQuestions(['slayer', 'boffin', 'imp'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.4')).toBe(true);
  });

  it('also fires OQ-22.3 (boffin alone) when slayer + boffin on roster', () => {
    const findings = ruleOpenQuestions(['slayer', 'boffin', 'imp'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.3')).toBe(true);
    expect(findings.some(f => f.rule_id === 'OQ-22.4')).toBe(true);
  });

  it('does not fire OQ-22.4 when only slayer is on roster', () => {
    // slayer has open_questions: ['22.4'] but trigger requires both slayer AND boffin
    const findings = ruleOpenQuestions(['slayer', 'imp', 'chef'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.4')).toBe(false);
  });
});

// ─── OQ 22.5 — cross_group: mayor + lunatic/magician ─────────────────────────

describe('ruleOpenQuestions — OQ 22.5 (mayor + bounce-confounder)', () => {
  it('fires OQ-22.5 when mayor + lunatic are on roster', () => {
    const findings = ruleOpenQuestions(['mayor', 'lunatic', 'imp'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.5')).toBe(true);
  });

  it('fires OQ-22.5 when mayor + magician are on roster', () => {
    const findings = ruleOpenQuestions(['mayor', 'magician', 'imp'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.5')).toBe(true);
  });

  it('does not fire OQ-22.5 when only mayor is on roster', () => {
    const findings = ruleOpenQuestions(['mayor', 'imp', 'chef'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.5')).toBe(false);
  });
});

// ─── OQ 22.6 — all_on_script: professor + cannibal ───────────────────────────

describe('ruleOpenQuestions — OQ 22.6 (professor + cannibal)', () => {
  it('fires OQ-22.6 when professor + cannibal are on roster', () => {
    const findings = ruleOpenQuestions(['professor', 'cannibal', 'imp'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.6')).toBe(true);
  });

  it('does not fire OQ-22.6 when only professor is on roster', () => {
    const findings = ruleOpenQuestions(['professor', 'imp', 'chef'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.6')).toBe(false);
  });
});

// ─── OQ 22.2 — all four group_a members ──────────────────────────────────────

describe('ruleOpenQuestions — OQ 22.2 (pacifist as group_a member)', () => {
  it('fires OQ-22.2 when pacifist + lleech are on roster', () => {
    const findings = ruleOpenQuestions(['pacifist', 'lleech', 'imp'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.2')).toBe(true);
  });
});

// ─── OQ 22.5 — group_b alone should not fire ─────────────────────────────────

describe('ruleOpenQuestions — OQ 22.5 (cross_group negative: group_b alone)', () => {
  it('does not fire OQ-22.5 when only lunatic is on roster (no mayor)', () => {
    const findings = ruleOpenQuestions(['lunatic', 'imp', 'chef'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.5')).toBe(false);
  });

  it('does not fire OQ-22.5 when only magician is on roster (no mayor)', () => {
    const findings = ruleOpenQuestions(['magician', 'imp', 'chef'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.5')).toBe(false);
  });
});

// ─── OQ finding schema shape ──────────────────────────────────────────────────

describe('ruleOpenQuestions — finding schema shape', () => {
  it('OQ findings always have empty characters and affected_characters arrays', () => {
    const findings = ruleOpenQuestions(['boffin', 'imp'], realCharById, makeContext());
    const oq = findings.find(f => f.rule_id === 'OQ-22.3');
    expect(oq).toBeDefined();
    expect(oq.characters).toEqual([]);
    expect(oq.affected_characters).toEqual([]);
    expect(oq.missing_mitigations).toEqual([]);
  });
});

// ─── atheist_mode does not suppress OQ findings ───────────────────────────────

describe('runRules — OQ findings are unaffected by atheist_mode', () => {
  it('OQ findings still land in notices when atheist_mode is true', () => {
    const result = runRules(
      ['boffin', 'soldier', 'imp', 'poisoner'],
      realCharById, makeContext({ hasAtheist: true }), { atheist_mode: true }
    );
    expect(result.notices.some(f => f.rule_id === 'OQ-22.3')).toBe(true);
  });

  it('OQ findings never appear in warnings even with atheist_mode', () => {
    const result = runRules(
      ['boffin', 'tea-lady', 'soldier', 'imp', 'poisoner'],
      realCharById, makeContext(), { atheist_mode: true }
    );
    expect(result.warnings.some(f => f.rule_id.startsWith('OQ-'))).toBe(false);
  });
});

// ─── De-duplication: same OQ from multiple characters ────────────────────────

describe('ruleOpenQuestions — de-duplication', () => {
  it('OQ-22.2 fires exactly once even when fool + sailor + tea-lady + lleech all on roster', () => {
    const findings = ruleOpenQuestions(
      ['fool', 'sailor', 'tea-lady', 'lleech', 'imp'], realCharById, makeContext());
    const oq22_2 = findings.filter(f => f.rule_id === 'OQ-22.2');
    expect(oq22_2).toHaveLength(1);
  });
});

// ─── OQ 22.7 — all_on_script: gambler + evil-twin ────────────────────────────

describe('ruleOpenQuestions — OQ 22.7 (gambler + evil-twin)', () => {
  it('fires OQ-22.7 when both gambler and evil-twin are on roster', () => {
    const findings = ruleOpenQuestions(['gambler', 'evil-twin', 'imp'], realCharById, makeContext());
    const oq = findings.find(f => f.rule_id === 'OQ-22.7');
    expect(oq).toBeDefined();
    expect(oq.severity).toBe('informational');
  });

  it('does not fire OQ-22.7 when only gambler is on roster', () => {
    // gambler has open_questions: ['22.7'] but the trigger requires evil-twin too
    const findings = ruleOpenQuestions(['gambler', 'imp', 'chef'], realCharById, makeContext());
    expect(findings.some(f => f.rule_id === 'OQ-22.7')).toBe(false);
  });
});

// ─── runRules integration ─────────────────────────────────────────────────────

describe('runRules — open-questions integration', () => {
  it('OQ-22.3 appears in notices when boffin is on roster', () => {
    const result = runRules(
      ['boffin', 'soldier', 'imp', 'poisoner'],
      realCharById, makeContext(), {}
    );
    const oq = result.notices.find(f => f.rule_id === 'OQ-22.3');
    expect(oq).toBeDefined();
    expect(oq.severity).toBe('informational');
  });

  it('OQ notices do not appear in errors', () => {
    const result = runRules(
      ['boffin', 'tea-lady', 'soldier', 'imp', 'poisoner'],
      realCharById, makeContext(), {}
    );
    expect(result.errors.some(f => f.rule_id.startsWith('OQ-'))).toBe(false);
  });

  it('output is flat serialisable JSON (NFR9)', () => {
    const result = runRules(
      ['boffin', 'tea-lady', 'soldier', 'imp', 'poisoner'],
      realCharById, makeContext(), {}
    );
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
