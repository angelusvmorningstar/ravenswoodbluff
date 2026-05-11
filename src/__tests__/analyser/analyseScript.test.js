import { describe, it, expect } from 'vitest';
import { analyseScript, runRules, buildScriptContext } from '../../js/analyser.js';
import chars from '../../data/characters.json';

const charById = new Map(chars.map(c => [c.id, c]));

// ─── input contract ───────────────────────────────────────────────────────────

describe('analyseScript — Set input', () => {
  it('accepts a Set and returns the standard output shape', () => {
    const result = analyseScript(new Set(['boffin', 'soldier', 'imp', 'poisoner']), charById, {});
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.notices)).toBe(true);
    expect(typeof result.djinn_required).toBe('boolean');
  });

  it('produces the same findings as runRules called with the equivalent array', () => {
    const roster = ['empath', 'chef', 'soldier', 'imp', 'poisoner'];
    const set = new Set(roster);
    const ctx = buildScriptContext(roster, charById);

    const viaAnalyse = analyseScript(set, charById, {});
    const viaDirect  = runRules(roster, charById, ctx, {});

    expect(viaAnalyse.errors).toEqual(viaDirect.errors);
    expect(viaAnalyse.warnings).toEqual(viaDirect.warnings);
    expect(viaAnalyse.notices).toEqual(viaDirect.notices);
    expect(viaAnalyse.djinn_required).toBe(viaDirect.djinn_required);
  });

  it('handles an empty Set without throwing', () => {
    expect(() => analyseScript(new Set(), charById, {})).not.toThrow();
  });
});

// ─── rule pipeline integration ────────────────────────────────────────────────

describe('analyseScript — rule pipeline', () => {
  it('E02 fires when droizonDensity is zero (no misinfo source)', () => {
    // empath, chef, imp — no droison source
    const result = analyseScript(new Set(['empath', 'chef', 'imp']), charById, {});
    expect(result.errors.some(f => f.rule_id === 'E02')).toBe(true);
  });

  it('OQ and N01 notices appear when triggered', () => {
    // boffin → OQ-22.3; alchemist+boffin → N01 jinx pair
    const result = analyseScript(
      new Set(['alchemist', 'boffin', 'soldier', 'imp', 'poisoner']),
      charById, {}
    );
    expect(result.notices.some(f => f.rule_id === 'OQ-22.3')).toBe(true);
    expect(result.notices.some(f => f.rule_id === 'N01')).toBe(true);
  });

  it('djinn_required is true when a jinxed pair is on script', () => {
    const result = analyseScript(
      new Set(['alchemist', 'boffin', 'soldier', 'imp', 'poisoner']),
      charById, {}
    );
    expect(result.djinn_required).toBe(true);
  });

  it('djinn_required is false when no jinxed pairs on script', () => {
    const result = analyseScript(
      new Set(['empath', 'chef', 'soldier', 'imp', 'poisoner']),
      charById, {}
    );
    expect(result.djinn_required).toBe(false);
  });

  it('atheist_mode option is respected', () => {
    // E02 (droizonDensity=0) should degrade to soft_warning in atheist_mode
    const result = analyseScript(
      new Set(['empath', 'chef', 'imp']),
      charById, { atheist_mode: true }
    );
    expect(result.errors.some(f => f.rule_id === 'E02')).toBe(false);
    expect(result.warnings.some(f => f.rule_id === 'E02')).toBe(true);
  });
});

// ─── NFR9 ─────────────────────────────────────────────────────────────────────

describe('analyseScript — NFR9', () => {
  it('output is flat serialisable JSON', () => {
    const result = analyseScript(
      new Set(['alchemist', 'boffin', 'heretic', 'baron', 'soldier', 'imp', 'poisoner']),
      charById, {}
    );
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
