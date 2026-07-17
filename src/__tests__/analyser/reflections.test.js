import { describe, it, expect } from 'vitest';
import { ruleRF01, ruleRF02, runRules } from '../../js/analyser.js';
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
function ctx(overrides) { return { ...BASE_CTX, ...overrides }; }

describe('reflection mechanism (v3.5 / C5)', () => {
  describe('RF-solo-demon — context-triggered on a single Demon', () => {
    it('fires when exactly one Demon is on script', () => {
      const r = ruleRF01([], ctx({ demonCount: 1 }), charById);
      expect(r).not.toBeNull();
      expect(r.kind).toBe('reflection');
      expect(r.severity).toBeNull();
      expect(r.rule_id).toBe('RF-solo-demon');
      expect(typeof r.prompt).toBe('string');
      expect(typeof r.why).toBe('string');
    });
    it('does NOT fire on a multi-Demon script (never evergreen)', () => {
      expect(ruleRF01([], ctx({ demonCount: 2 }), charById)).toBeNull();
    });
  });

  describe('RF-confirmation-heavy — context-triggered on a dense confirmation cluster', () => {
    it('fires when 3+ hard-confirmation roles are present', () => {
      const r = ruleRF02([], ctx({ confirmationCluster: new Set(['virgin', 'slayer', 'fool']) }), charById);
      expect(r).not.toBeNull();
      expect(r.rule_id).toBe('RF-confirmation-heavy');
      expect(r.kind).toBe('reflection');
      expect(r.characters).toEqual(['virgin', 'slayer', 'fool']);
    });
    it('does NOT fire below the threshold', () => {
      expect(ruleRF02([], ctx({ confirmationCluster: new Set(['virgin', 'slayer']) }), charById)).toBeNull();
    });
  });

  it('a script meeting no reflection trigger produces zero reflections (the anti-evergreen guarantee)', () => {
    const { reflections } = runRules(
      ['washerwoman', 'chef', 'po', 'no-dashii', 'poisoner'],
      charById,
      ctx({ demonCount: 2, confirmationCluster: new Set() }),
    );
    expect(reflections).toEqual([]);
  });

  it('reflections route to their own stream, never the gate, and stay serialisable', () => {
    const out = runRules(
      ['empath', 'chef', 'imp', 'poisoner'],
      charById,
      ctx({ demonCount: 1, confirmationCluster: new Set(['virgin', 'slayer', 'fool']) }),
    );
    expect(out.reflections.length).toBe(2);
    for (const bucket of [out.errors, out.warnings, out.notices]) {
      for (const f of bucket) expect(f.kind).toBe('verdict');
    }
    expect(out.reflections.every(r => r.kind === 'reflection')).toBe(true);
    expect(() => JSON.stringify(out)).not.toThrow();
  });
});
