import { describe, it, expect } from 'vitest';
import { advisoriesCorrectiveFabled, runRules } from '../../js/analyser.js';
import chars from '../../data/characters.json';

const charById = new Map(chars.map(c => [c.id, c]));

// Minimal scriptContext shape. Defaults represent a well-formed script that demands NO
// corrective Fabled: Outsider count obfuscated, droison present, no extra evil.
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
const ids = (findings) => findings.map(a => a.rule_id);

describe('corrective-Fabled advisories', () => {
  it('emits nothing for a well-formed script', () => {
    expect(advisoriesCorrectiveFabled([], ctx(), charById)).toEqual([]);
  });

  it('all corrective-Fabled findings are advisories with official provenance', () => {
    const out = advisoriesCorrectiveFabled(
      [], ctx({ hasOutsiderObfuscation: false, droizonDensity: 0, hasExtraEvil: true }), charById,
    );
    expect(out.length).toBe(3);
    for (const a of out) {
      expect(a.kind).toBe('advisory');
      expect(a.severity).toBeNull();
      expect(a.provenance).toBe('official');
      expect(typeof a.notice_text).toBe('string');
    }
  });

  describe('AF-sentinel — fixed Outsider count', () => {
    it('fires when Outsider count is not obfuscated and no Sentinel', () => {
      expect(ids(advisoriesCorrectiveFabled([], ctx({ hasOutsiderObfuscation: false }), charById))).toContain('AF-sentinel');
    });
    it('suppressed when a Sentinel is on script', () => {
      expect(ids(advisoriesCorrectiveFabled([], ctx({ hasOutsiderObfuscation: false, hasSentinel: true }), charById))).not.toContain('AF-sentinel');
    });
    it('suppressed when the Outsider count is already obfuscated', () => {
      expect(ids(advisoriesCorrectiveFabled([], ctx({ hasOutsiderObfuscation: true }), charById))).not.toContain('AF-sentinel');
    });
  });

  describe('AF-fibbin — no droison', () => {
    it('fires when droison density is zero and no Fibbin', () => {
      expect(ids(advisoriesCorrectiveFabled([], ctx({ droizonDensity: 0 }), charById))).toContain('AF-fibbin');
    });
    it('suppressed when a Fibbin is on the roster', () => {
      expect(ids(advisoriesCorrectiveFabled(['fibbin'], ctx({ droizonDensity: 0 }), charById))).not.toContain('AF-fibbin');
    });
    it('suppressed when droison is present', () => {
      expect(ids(advisoriesCorrectiveFabled([], ctx({ droizonDensity: 1 }), charById))).not.toContain('AF-fibbin');
    });
  });

  describe('AF-spirit-of-ivory — extra-evil source', () => {
    it('fires when an extra-evil source is present and no Spirit of Ivory', () => {
      expect(ids(advisoriesCorrectiveFabled([], ctx({ hasExtraEvil: true }), charById))).toContain('AF-spirit-of-ivory');
    });
    it('suppressed when a Spirit of Ivory is on script', () => {
      expect(ids(advisoriesCorrectiveFabled([], ctx({ hasExtraEvil: true, hasSpiritOfIvory: true }), charById))).not.toContain('AF-spirit-of-ivory');
    });
  });

  it('corrective-Fabled advisories reach the advisories stream, never the gate', () => {
    // A no-droison, fixed-Outsider roster also trips E02/E03 hard errors, exercising the gate.
    const { errors, warnings, notices, advisories } = runRules(
      ['washerwoman', 'chef', 'imp', 'poisoner'],
      charById,
      ctx({ droizonDensity: 0, hasOutsiderObfuscation: false }),
    );
    expect(advisories.some(a => a.rule_id === 'AF-sentinel')).toBe(true);
    expect(advisories.some(a => a.rule_id === 'AF-fibbin')).toBe(true);
    for (const bucket of [errors, warnings, notices]) {
      expect(bucket.some(f => String(f.rule_id).startsWith('AF-'))).toBe(false);
      for (const f of bucket) expect(f.kind).toBe('verdict');
    }
  });
});
