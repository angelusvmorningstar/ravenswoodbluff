import { describe, it, expect } from 'vitest';
import { ruleN41, runRules } from '../../js/analyser.js';
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
function makeFakeCharById(...entries) { return new Map(entries.map(e => [e.id, e])); }

const ROSTER = ['empath', 'chef', 'imp', 'poisoner'];

describe('ruleN41 — confirmation cluster density', () => {
  it('returns null when confirmationCluster.size < 3', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer', 'virgin']) });
    expect(ruleN41(ROSTER, ctx, realCharById)).toBeNull();
  });

  it('returns null when confirmationCluster is empty', () => {
    expect(ruleN41(ROSTER, makeContext(), realCharById)).toBeNull();
  });

  it('returns a Finding when confirmationCluster.size === 3', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer', 'virgin', 'fool']) });
    const f = ruleN41(ROSTER, ctx, realCharById);
    expect(f).not.toBeNull();
    expect(f.rule_id).toBe('N41');
    expect(f.severity).toBe('informational');
    expect(f.type).toBe('script');
    expect(typeof f.notice_text).toBe('string');
    expect(Array.isArray(f.missing_mitigations)).toBe(true);
    expect(Array.isArray(f.affected_characters)).toBe(true);
  });

  it('returns a Finding when confirmationCluster.size > 3', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer', 'virgin', 'fool', 'sailor']) });
    expect(ruleN41(ROSTER, ctx, realCharById)).not.toBeNull();
  });
});


describe('runRules — informational cluster group integration', () => {
  it('N41 fires into notices when cluster size >= 3', () => {
    const ctx = makeContext({ confirmationCluster: new Set(['slayer', 'virgin', 'fool']) });
    const result = runRules(ROSTER, realCharById, ctx, {});
    expect(result.notices.some(f => f.rule_id === 'N41')).toBe(true);
  });

  it('output is flat serialisable JSON (NFR9)', () => {
    const ctx = makeContext({
      confirmationCluster: new Set(['slayer', 'virgin', 'fool']),
      executionSurvivalCluster: new Set(['sailor', 'fool']),
    });
    const result = runRules(ROSTER, realCharById, ctx, {});
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('clean case — empty clusters produce no N41/N42/N43 notices', () => {
    const ctx = makeContext({ droizonDensity: 2 }); // droizon > 0 so E02 doesn't fire
    const result = runRules(ROSTER, realCharById, ctx, {});
    const clusterRules = result.notices.filter(f => f.rule_id === 'N41');
    expect(clusterRules).toHaveLength(0);
  });
});
