import { describe, it, expect } from 'vitest';
import {
  ruleW01, ruleW06, ruleW07, ruleW08, ruleW09, ruleW10, ruleW11,
  ruleW13, ruleW15, ruleW16, ruleW17, ruleW18, ruleW20,
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

// ─── ruleW01 — info-dense role without bluff cover ────────────────────────────

describe('ruleW01 — info-dense Townsfolk without bluff cover', () => {
  it('returns null when no grimpeekerNeeded/info-cover role on roster', () => {
    expect(ruleW01(['imp', 'chef', 'empath'], makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when balloonist on roster without spy or widow', () => {
    const f = ruleW01(['balloonist', 'imp', 'chef'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W01');
    expect(f.severity).toBe('soft_warning');
    expect(f.type).toBe('character');
    expect(f.characters).toContain('balloonist');
    expect(f.affected_characters).toContain('balloonist');
  });

  it('returns null when balloonist and spy both on roster', () => {
    expect(ruleW01(['balloonist', 'spy', 'imp'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when balloonist and widow both on roster', () => {
    expect(ruleW01(['balloonist', 'widow', 'imp'], makeContext(), realCharById)).toBeNull();
  });

  it('includes all needing roles in affected_characters', () => {
    const f = ruleW01(['balloonist', 'chambermaid', 'imp'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.affected_characters).toContain('balloonist');
    expect(f.affected_characters).toContain('chambermaid');
  });
});


// ─── ruleW06 — high TF count + low misinfo ────────────────────────────────────

describe('ruleW06 — information-dense Townsfolk with low misinfo', () => {
  it('returns null when droizonDensity >= 2', () => {
    expect(ruleW06([], makeContext({ townsfolkCount: 13, droizonDensity: 2 }), realCharById)).toBeNull();
  });

  it('returns null when townsfolkCount <= 7', () => {
    expect(ruleW06([], makeContext({ townsfolkCount: 7, droizonDensity: 1 }), realCharById)).toBeNull();
  });

  it('returns a Finding when townsfolkCount > 7 and droizonDensity < 2', () => {
    const f = ruleW06([], makeContext({ townsfolkCount: 13, droizonDensity: 1 }), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W06');
    expect(f.severity).toBe('soft_warning');
    expect(f.type).toBe('script');
  });

  it('returns a Finding when droizonDensity === 0', () => {
    expect(ruleW06([], makeContext({ townsfolkCount: 13, droizonDensity: 0 }), realCharById)).not.toBeNull();
  });

  it('returns a Finding when townsfolkCount === 8 (boundary)', () => {
    const f = ruleW06([], makeContext({ townsfolkCount: 8, droizonDensity: 1 }), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W06');
  });
});

// ─── ruleW07 — misinfo overload ───────────────────────────────────────────────

describe('ruleW07 — misinfo overload', () => {
  it('returns null when droizonDensity <= 4', () => {
    expect(ruleW07([], makeContext({ droizonDensity: 4 }), realCharById)).toBeNull();
  });

  it('returns a Finding when droizonDensity === 5', () => {
    const f = ruleW07([], makeContext({ droizonDensity: 5 }), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W07');
    expect(f.severity).toBe('soft_warning');
    expect(typeof f.notice_text).toBe('string');
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
  });

  it('returns a Finding when droizonDensity > 5', () => {
    expect(ruleW07([], makeContext({ droizonDensity: 6 }), realCharById)).not.toBeNull();
  });
});


// ─── ruleW08 — multi-Demon with no dead-can-be-evil ──────────────────────────

describe('ruleW08 — multi-Demon with no dead-can-be-evil source', () => {
  it('returns null when only one Demon on script', () => {
    expect(ruleW08(['no-dashii', 'poisoner'], makeContext({ demonCount: 1 }), realCharById)).toBeNull();
  });

  it('returns a Finding when 2+ Demons and no dead-can-be-evil source', () => {
    const f = ruleW08(['no-dashii', 'pukka', 'poisoner'], makeContext({ demonCount: 2 }), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W08');
    expect(f.severity).toBe('soft_warning');
    expect(f.type).toBe('script');
  });

  it('returns null when a dead-can-be-evil Demon is present (imp)', () => {
    expect(ruleW08(['no-dashii', 'imp', 'poisoner'], makeContext({ demonCount: 2 }), realCharById)).toBeNull();
  });

  it('returns null when a dead-can-be-evil Minion is present (scarlet-woman)', () => {
    expect(ruleW08(['no-dashii', 'pukka', 'scarlet-woman'], makeContext({ demonCount: 2 }), realCharById)).toBeNull();
  });
});


// ─── ruleW09 — loud/quiet Demon mix ──────────────────────────────────────────

describe('ruleW09 — loud Demon mixed with quiet Demon', () => {
  it('returns null when only quiet Demons on roster', () => {
    expect(ruleW09(['imp', 'poisoner', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when only one Demon (loud)', () => {
    expect(ruleW09(['leviathan', 'poisoner', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when loud (leviathan) and quiet (imp) Demons are mixed', () => {
    const f = ruleW09(['leviathan', 'imp', 'poisoner'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W09');
    expect(f.severity).toBe('soft_warning');
    expect(f.type).toBe('character');
    expect(f.characters).toContain('leviathan');
    expect(f.characters).toContain('imp');
  });

  it('returns a Finding when riot (loud) and imp (quiet) are mixed', () => {
    const f = ruleW09(['riot', 'imp', 'poisoner'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W09');
    expect(f.characters).toContain('riot');
    expect(f.characters).toContain('imp');
  });

  it('returns null when only loud Demons are on roster (leviathan + riot)', () => {
    expect(ruleW09(['leviathan', 'riot', 'poisoner'], makeContext(), realCharById)).toBeNull();
  });
});

// ─── ruleW10 — Vortox/Atheist advisory (array output) ────────────────────────

describe('ruleW10 — Vortox/Atheist advisory', () => {
  it('returns [] when no vortoxFlag character on roster', () => {
    expect(ruleW10(['imp', 'chef', 'empath'], makeContext(), realCharById)).toEqual([]);
  });

  it('returns one Finding when vortox is on roster', () => {
    const findings = ruleW10(['vortox', 'poisoner', 'chef'], makeContext(), realCharById);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule_id).toBe('W10');
    expect(findings[0].severity).toBe('soft_warning');
    expect(findings[0].characters).toContain('vortox');
  });

  it('returns one Finding when atheist is on roster', () => {
    const findings = ruleW10(['atheist', 'poisoner', 'chef'], makeContext(), realCharById);
    expect(findings).toHaveLength(1);
    expect(findings[0].characters).toContain('atheist');
  });

  it('returns two Findings when both vortox and atheist are on roster', () => {
    const findings = ruleW10(['vortox', 'atheist', 'poisoner'], makeContext(), realCharById);
    expect(findings).toHaveLength(2);
  });
});

// ─── ruleW11 — Mathematician with mixed misinfo shapes ────────────────────────

describe('ruleW11 — Mathematician with mixed misinfo shapes', () => {
  it('returns null when mathematician is not on roster', () => {
    expect(ruleW11(['imp', 'poisoner', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when fewer than 3 misinfo chars on roster', () => {
    expect(ruleW11(['mathematician', 'poisoner', 'imp'], makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when mathematician + 3 misinfo chars of mixed shapes', () => {
    // poisoner: arbitrary, drunk: persistent-column, widow: targeted — 3 distinct shapes
    const roster = ['mathematician', 'poisoner', 'drunk', 'widow', 'imp'];
    const f = ruleW11(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W11');
    expect(f.severity).toBe('soft_warning');
    expect(f.characters).toContain('mathematician');
  });

  it('returns null when all 3 misinfo chars share the same shape', () => {
    // drunk, lunatic, puzzlemaster all have shape 'persistent-column'
    const roster = ['mathematician', 'drunk', 'lunatic', 'puzzlemaster', 'imp'];
    expect(ruleW11(roster, makeContext(), realCharById)).toBeNull();
  });

  it('returns null when only 2 misinfo chars present even if their shapes differ', () => {
    // poisoner + drunk = 2 chars (< 3 threshold); shapes differ but count is not met
    const roster = ['mathematician', 'poisoner', 'drunk', 'imp'];
    expect(ruleW11(roster, makeContext(), realCharById)).toBeNull();
  });
});

// ─── ruleW13 — misregistration + nonconformist info ──────────────────────────

describe('ruleW13 — misregistration plus nonconformist info', () => {
  it('returns null when no misregistration character on roster', () => {
    expect(ruleW13(['artist', 'imp', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when no nonconformistInfo character on roster', () => {
    expect(ruleW13(['recluse', 'imp', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when recluse (misregistration) and artist (nonconformistInfo) both on roster', () => {
    const f = ruleW13(['recluse', 'artist', 'imp'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W13');
    expect(f.severity).toBe('soft_warning');
    expect(f.characters).toContain('recluse');
    expect(f.characters).toContain('artist');
  });

  it('returns a Finding when spy (misregistration) and savant (nonconformistInfo) both on roster', () => {
    const f = ruleW13(['spy', 'savant', 'imp'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W13');
    expect(f.characters).toContain('spy');
    expect(f.characters).toContain('savant');
  });

  it('returns a Finding when zombuul (misregistration) and amnesiac (nonconformistInfo) both on roster', () => {
    const f = ruleW13(['zombuul', 'amnesiac', 'imp'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W13');
    expect(f.characters).toContain('zombuul');
    expect(f.characters).toContain('amnesiac');
  });
});

// ─── ruleW15 — Boffin with heavily confirmable goods ─────────────────────────

describe('ruleW15 — Boffin with heavily confirmable goods', () => {
  it('returns null when boffin is not on roster', () => {
    expect(ruleW15(['fool', 'slayer', 'virgin', 'imp'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when fewer than 3 hard-confirmation roles alongside boffin', () => {
    const roster = ['boffin', 'fool', 'slayer', 'imp'];
    expect(ruleW15(roster, makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when boffin + 3 hard-confirmation roles on roster', () => {
    const roster = ['boffin', 'fool', 'slayer', 'virgin', 'imp'];
    const f = ruleW15(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W15');
    expect(f.severity).toBe('soft_warning');
    expect(f.characters).toContain('boffin');
    expect(f.affected_characters).toContain('fool');
  });
});

// ─── ruleW16 — Mayor with bounce-confounders only ────────────────────────────

describe('ruleW16 — Mayor with bounce-confounders only', () => {
  it('returns null when mayor is not on roster', () => {
    expect(ruleW16(['lunatic', 'imp', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when mayor is on roster but no bounce-confounders present', () => {
    expect(ruleW16(['mayor', 'imp', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when mayor is on roster with a claim-confounder (drunk)', () => {
    expect(ruleW16(['mayor', 'drunk', 'imp'], makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when mayor + lunatic (bounce) but no claim-confounder', () => {
    const f = ruleW16(['mayor', 'lunatic', 'imp'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W16');
    expect(f.severity).toBe('soft_warning');
    expect(f.characters).toContain('mayor');
  });

  it('returns a Finding when mayor + magician (bounce) but no claim-confounder', () => {
    const f = ruleW16(['mayor', 'magician', 'imp'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W16');
  });
});

// ─── ruleW17 — no night-protection with quiet one-kill Demon ─────────────────

describe('ruleW17 — no night-protection with quiet one-kill Demon', () => {
  it('returns null when no demon on roster', () => {
    expect(ruleW17(['empath', 'chef', 'poisoner'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when only loud Demon on roster (leviathan)', () => {
    expect(ruleW17(['leviathan', 'poisoner', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when imp (quiet) on roster without night-protection', () => {
    const f = ruleW17(['imp', 'poisoner', 'chef'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W17');
    expect(f.severity).toBe('soft_warning');
    expect(f.characters).toContain('imp');
  });

  it('returns null when imp on roster with soldier (night-protection)', () => {
    expect(ruleW17(['imp', 'soldier', 'poisoner'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when imp on roster with monk (night-protection)', () => {
    expect(ruleW17(['imp', 'monk', 'poisoner'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when imp on roster with innkeeper (night-protection)', () => {
    expect(ruleW17(['imp', 'innkeeper', 'poisoner'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when imp on roster with sailor (night-protection)', () => {
    expect(ruleW17(['imp', 'sailor', 'poisoner'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when a multi-kill Demon (po) is on roster — not a quiet single-kill Demon', () => {
    expect(ruleW17(['po', 'poisoner', 'chef'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when a multi-kill Demon (shabaloth) is on roster', () => {
    expect(ruleW17(['shabaloth', 'poisoner', 'chef'], makeContext(), realCharById)).toBeNull();
  });
});

// ─── ruleW18 — high jinx count ────────────────────────────────────────────────

describe('ruleW18 — high jinx count', () => {
  it('returns null when jinxCount <= 5', () => {
    expect(ruleW18([], makeContext({ jinxCount: 5 }), realCharById)).toBeNull();
  });

  it('returns a Finding when jinxCount === 6', () => {
    const f = ruleW18([], makeContext({ jinxCount: 6 }), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W18');
    expect(f.severity).toBe('soft_warning');
    expect(f.type).toBe('script');
    expect(typeof f.notice_text).toBe('string');
  });

  it('returns a Finding when jinxCount > 6', () => {
    expect(ruleW18([], makeContext({ jinxCount: 10 }), realCharById)).not.toBeNull();
  });
});

// ─── ruleW20 — strong informational roles without certainty-underminer ────────

describe('ruleW20 — strong informational roles with nothing to undermine certainty', () => {
  it('returns null when confirmationCluster.size < 2', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer']) });
    expect(ruleW20([], ctx, realCharById)).toBeNull();
  });

  it('returns null when drunk is on roster', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer', 'virgin']) });
    expect(ruleW20(['drunk', 'imp', 'chef'], ctx, realCharById)).toBeNull();
  });

  it('returns null when marionette is on roster', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer', 'virgin']) });
    expect(ruleW20(['marionette', 'imp', 'chef'], ctx, realCharById)).toBeNull();
  });

  it('returns null when puzzlemaster is on roster', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer', 'virgin']) });
    expect(ruleW20(['puzzlemaster', 'imp', 'chef'], ctx, realCharById)).toBeNull();
  });

  it('returns a Finding when cluster >= 2 and no certainty-underminer', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer', 'virgin']) });
    const f = ruleW20(['slayer', 'virgin', 'imp'], ctx, realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('W20');
    expect(f.severity).toBe('informational');
    expect(f.type).toBe('script');
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
  });

  it('returns null when lleech is on roster (certainty-underminer)', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer', 'virgin']) });
    expect(ruleW20(['lleech', 'slayer', 'virgin'], ctx, realCharById)).toBeNull();
  });

  it('returns null when boffin is on roster (certainty-underminer)', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer', 'virgin']) });
    expect(ruleW20(['boffin', 'slayer', 'virgin', 'imp'], ctx, realCharById)).toBeNull();
  });
});

// ─── runRules integration ─────────────────────────────────────────────────────

describe('runRules — soft-warning group integration', () => {
  it('W01 fires into warnings when balloonist present without spy/widow', () => {
    const roster = ['balloonist', 'soldier', 'imp', 'poisoner'];
    const result = runRules(roster, realCharById, makeContext(), {});
    expect(result.warnings.some(f => f.rule_id === 'W01')).toBe(true);
  });

  it('W07 fires into warnings when droizonDensity > 4', () => {
    const ctx = makeContext({ droizonDensity: 6 });
    const result = runRules(['soldier', 'imp', 'poisoner'], realCharById, ctx, {});
    expect(result.warnings.some(f => f.rule_id === 'W07')).toBe(true);
  });

  it('W10 fires into warnings when vortox on roster', () => {
    const roster = ['vortox', 'soldier', 'poisoner'];
    const result = runRules(roster, realCharById, makeContext(), {});
    expect(result.warnings.some(f => f.rule_id === 'W10')).toBe(true);
  });

  it('W17 fires into warnings when quiet Demon present without night-protection', () => {
    const roster = ['empath', 'imp', 'poisoner'];
    const result = runRules(roster, realCharById, makeContext(), {});
    expect(result.warnings.some(f => f.rule_id === 'W17')).toBe(true);
  });

  it('W18 fires into warnings when jinxCount > 5', () => {
    const ctx = makeContext({ jinxCount: 6 });
    const result = runRules(['soldier', 'imp', 'poisoner'], realCharById, ctx, {});
    expect(result.warnings.some(f => f.rule_id === 'W18')).toBe(true);
  });

  it('multiple W-rules fire simultaneously', () => {
    const roster = ['balloonist', 'heretic', 'imp', 'poisoner'];
    const ctx = makeContext({ droizonDensity: 6, hasHeretic: true, hasSentinel: false });
    const result = runRules(roster, realCharById, ctx, {});
    expect(result.warnings.some(f => f.rule_id === 'W01')).toBe(true);
    expect(result.warnings.some(f => f.rule_id === 'W07')).toBe(true);
    expect(result.warnings.some(f => f.rule_id === 'W12')).toBe(true);
  });

  it('output is flat serialisable JSON (NFR9)', () => {
    const roster = ['vortox', 'balloonist', 'leviathan', 'imp', 'poisoner'];
    const ctx = makeContext({ droizonDensity: 6, hasHeretic: true, hasSentinel: false });
    const result = runRules(roster, realCharById, ctx, {});
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('clean case — no W-rules fire when context and roster are clear', () => {
    // soldier provides night protection (W17 suppressed); droizonDensity:2 suppresses W06/W07;
    // no balloonist (W01); no vortox/atheist (W10); no mathematician (W11); no heretic (W12);
    // no recluse/artist (W13); no boffin (W15); no mayor (W16); jinxCount:0 (W18);
    // confirmationCluster empty (W20); minionVolumeScore.min null (W05).
    const ctx = makeContext({
      droizonDensity: 2,
      jinxCount: 0,
      hasHeretic: false,
      confirmationCluster: new Set(),
      minionVolumeScore: { min: null, max: null, spread: 0, tiers: [] },
    });
    const roster = ['empath', 'chef', 'soldier', 'imp', 'poisoner'];
    const result = runRules(roster, realCharById, ctx, {});
    const wRules = result.warnings.filter(f => f.rule_id.startsWith('W'));
    expect(wRules).toHaveLength(0);
  });
});
