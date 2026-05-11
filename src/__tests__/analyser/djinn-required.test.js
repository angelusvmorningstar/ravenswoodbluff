import { describe, it, expect } from 'vitest';
import { runRules } from '../../js/analyser.js';
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

describe('djinn_required — mechanical jinx pair', () => {
  it('is true when roster contains a known jinxed pair', () => {
    const result = runRules(
      ['alchemist', 'boffin', 'soldier', 'imp', 'poisoner'],
      realCharById, makeContext(), {}
    );
    expect(result.djinn_required).toBe(true);
  });

  it('is false when roster contains no jinxed pairs', () => {
    const result = runRules(
      ['empath', 'chef', 'soldier', 'imp', 'poisoner'],
      realCharById, makeContext(), {}
    );
    expect(result.djinn_required).toBe(false);
  });
});

describe('djinn_required — hate jinx pair', () => {
  it('is true for a hate pair (heretic + baron) even though E04 fires hard_error', () => {
    const result = runRules(
      ['heretic', 'baron', 'soldier', 'imp', 'poisoner'],
      realCharById, makeContext({ hasHeretic: true, hasSentinel: false }), {}
    );
    expect(result.djinn_required).toBe(true);
  });
});

describe('djinn_required — atheist_mode does not suppress it', () => {
  it('is true with atheist_mode:true when a jinxed pair is on roster', () => {
    const result = runRules(
      ['alchemist', 'boffin', 'soldier', 'imp', 'poisoner'],
      realCharById, makeContext({ hasAtheist: true }), {}
    );
    expect(result.djinn_required).toBe(true);
  });

  it('is false with atheist_mode:true when no jinxed pairs', () => {
    const result = runRules(
      ['empath', 'chef', 'soldier', 'imp', 'poisoner'],
      realCharById, makeContext({ hasAtheist: true }), {}
    );
    expect(result.djinn_required).toBe(false);
  });
});

describe('djinn_required — multiple pairs', () => {
  it('is true (not a count) when multiple jinxed pairs are on roster', () => {
    const result = runRules(
      ['alchemist', 'boffin', 'slayer', 'lleech', 'imp'],
      realCharById, makeContext(), {}
    );
    expect(result.djinn_required).toBe(true);
  });
});

describe('djinn_required — hate pair with Sentinel (E04 suppressed but Djinn still required)', () => {
  it('is true for a hate pair even when Sentinel suppresses E04', () => {
    const result = runRules(
      ['heretic', 'baron', 'sentinel', 'imp', 'poisoner'],
      realCharById, makeContext({ hasHeretic: true, hasSentinel: true }), {}
    );
    expect(result.djinn_required).toBe(true);
  });
});

describe('djinn_required — NFR9', () => {
  it('output is flat serialisable JSON including djinn_required', () => {
    const result = runRules(
      ['alchemist', 'boffin', 'soldier', 'imp', 'poisoner'],
      realCharById, makeContext(), {}
    );
    expect(typeof result.djinn_required).toBe('boolean');
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
