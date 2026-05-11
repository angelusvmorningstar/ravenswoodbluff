import { describe, it, expect } from 'vitest';
import { ruleN66, ruleN67, ruleN68, runRules } from '../../js/analyser.js';
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

describe('ruleN66 — Minion volume spread', () => {
  it('returns null when minionVolumeScore.min === null (no qualifying Minions)', () => {
    const ctx = makeContext({ minionVolumeScore: { min: null, max: null, spread: 4, tiers: [] } });
    expect(ruleN66(ROSTER, ctx, realCharById)).toBeNull();
  });

  it('returns null when spread < 3', () => {
    const ctx = makeContext({ minionVolumeScore: { min: 1, max: 3, spread: 2, tiers: ['pseudosilent', 'confoundable'] } });
    expect(ruleN66(ROSTER, ctx, realCharById)).toBeNull();
  });

  it('returns null when spread === 2', () => {
    const ctx = makeContext({ minionVolumeScore: { min: 0, max: 2, spread: 2, tiers: ['silent', 'confoundable'] } });
    expect(ruleN66(ROSTER, ctx, realCharById)).toBeNull();
  });

  it('returns a Finding when min is set and spread === 3', () => {
    const ctx = makeContext({ minionVolumeScore: { min: 0, max: 3, spread: 3, tiers: ['silent', 'confoundable'] } });
    const f = ruleN66(ROSTER, ctx, realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N66');
    expect(f.severity).toBe('informational');
    expect(f.type).toBe('script');
    expect(typeof f.notice_text).toBe('string');
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
    expect(Array.isArray(f.affected_characters)).toBe(true);
  });

  it('returns a Finding when spread > 3', () => {
    const ctx = makeContext({ minionVolumeScore: { min: 0, max: 4, spread: 4, tiers: ['silent', 'loud'] } });
    expect(ruleN66(ROSTER, ctx, realCharById)).not.toBeNull();
  });
});

describe('ruleN67 — grimpeekerNeeded without grimpeeker', () => {
  it('returns null when no grimpeekerNeeded character on roster', () => {
    const roster = ['imp', 'poisoner', 'chef'];
    expect(ruleN67(roster, makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when balloonist on roster and no grimpeeker', () => {
    const roster = ['balloonist', 'imp', 'chef'];
    const f = ruleN67(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N67');
    expect(f.severity).toBe('informational');
    expect(f.affected_characters).toContain('balloonist');
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
  });

  it('returns null when balloonist and spy both on roster (grimpeeker present)', () => {
    const roster = ['balloonist', 'spy', 'imp'];
    expect(ruleN67(roster, makeContext(), realCharById)).toBeNull();
  });

  it('returns null when balloonist and widow both on roster (grimpeeker present)', () => {
    const roster = ['balloonist', 'widow', 'imp'];
    expect(ruleN67(roster, makeContext(), realCharById)).toBeNull();
  });

  it('includes all grimpeekerNeeded roles in affected_characters', () => {
    const roster = ['balloonist', 'chambermaid', 'imp'];
    const f = ruleN67(roster, makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.affected_characters).toContain('balloonist');
    expect(f.affected_characters).toContain('chambermaid');
  });

  it('characters and affected_characters are the same set for a char-type finding', () => {
    const f = ruleN67(['balloonist', 'imp'], makeContext(), realCharById);
    expect(f.type).toBe('character');
    expect(f.characters).toContain('balloonist');
    expect(f.characters).toEqual(f.affected_characters);
  });
});

describe('ruleN67 — chambermaid as standalone grimpeekerNeeded trigger', () => {
  it('returns a Finding when chambermaid is on roster without grimpeeker', () => {
    const f = ruleN67(['chambermaid', 'imp', 'chef'], makeContext(), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N67');
    expect(f.type).toBe('character');
    expect(f.characters).toContain('chambermaid');
    expect(f.affected_characters).toContain('chambermaid');
  });

  it('returns null when chambermaid and spy are both on roster', () => {
    expect(ruleN67(['chambermaid', 'spy', 'imp'], makeContext(), realCharById)).toBeNull();
  });

  it('returns null when chambermaid and widow are both on roster', () => {
    expect(ruleN67(['chambermaid', 'widow', 'imp'], makeContext(), realCharById)).toBeNull();
  });
});

describe('ruleN68 — high droison density', () => {
  it('returns null when droizonDensity < 4', () => {
    expect(ruleN68(ROSTER, makeContext({ droizonDensity: 3 }), realCharById)).toBeNull();
  });

  it('returns null when droizonDensity === 0', () => {
    expect(ruleN68(ROSTER, makeContext({ droizonDensity: 0 }), realCharById)).toBeNull();
  });

  it('returns a Finding when droizonDensity === 4', () => {
    const f = ruleN68(ROSTER, makeContext({ droizonDensity: 4 }), realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N68');
    expect(f.severity).toBe('informational');
    expect(f.type).toBe('script');
    expect(typeof f.notice_text).toBe('string');
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
  });

  it('returns a Finding when droizonDensity > 4', () => {
    expect(ruleN68(ROSTER, makeContext({ droizonDensity: 6 }), realCharById)).not.toBeNull();
  });
});

describe('runRules — volume/density group integration', () => {
  it('N66 fires into notices when volume spread is wide', () => {
    const ctx = makeContext({ minionVolumeScore: { min: 0, max: 4, spread: 4, tiers: ['silent', 'loud'] } });
    const result = runRules(ROSTER, realCharById, ctx, {});
    expect(result.notices.some(f => f.rule_id === 'N66')).toBe(true);
  });

  it('N67 fires into notices when balloonist present without grimpeeker', () => {
    const roster = ['balloonist', 'imp', 'chef'];
    const result = runRules(roster, realCharById, makeContext(), {});
    expect(result.notices.some(f => f.rule_id === 'N67')).toBe(true);
  });

  it('N68 fires into notices when droizonDensity >= 4', () => {
    const ctx = makeContext({ droizonDensity: 4 });
    const result = runRules(ROSTER, realCharById, ctx, {});
    expect(result.notices.some(f => f.rule_id === 'N68')).toBe(true);
  });

  it('output is flat serialisable JSON (NFR9)', () => {
    const ctx = makeContext({
      minionVolumeScore: { min: 0, max: 4, spread: 4, tiers: ['silent', 'loud'] },
      droizonDensity: 4,
    });
    const roster = ['balloonist', 'imp', 'chef'];
    const result = runRules(roster, realCharById, ctx, {});
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('clean case — no N66/N67/N68 notices when conditions clear', () => {
    const ctx = makeContext({ droizonDensity: 2 }); // spread 0, no grimpeekerNeeded, density < 4
    const result = runRules(ROSTER, realCharById, ctx, {});
    const volumeRules = result.notices.filter(f => ['N66', 'N67', 'N68'].includes(f.rule_id));
    expect(volumeRules).toHaveLength(0);
  });
});
