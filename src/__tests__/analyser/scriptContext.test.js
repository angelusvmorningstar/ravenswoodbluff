import { describe, it, expect } from 'vitest';
import { buildScriptContext } from '../../js/analyser.js';
import chars from '../../data/characters.json';

const charById = new Map(chars.map(c => [c.id, c]));

// Test roster A — exercises all context fields.
// Verified field values (from characters.json, 2026-05-10):
//   poisoner: minion, lint.misinfo=true, volume=silent
//   witch:    minion, lint.misinfo=true, volume=pseudosilent
//   mezepheles: minion, volume=loud
//   slayer:   townsfolk, confirmations[].type='hard' (v2.1-tagged)
//   heretic:  outsider (triggers hasHeretic)
//   empath:   townsfolk (no special flags)
//   chef:     townsfolk (no special flags)
//   recluse:  outsider (no special flags)
//   imp:      demon
//   sentinel: fabled (triggers hasSentinel; not counted in any team)
//   spirit-of-ivory: fabled (triggers hasSpiritOfIvory)
const ROSTER_A = [
  'slayer', 'heretic', 'empath', 'chef',
  'recluse',
  'poisoner', 'witch', 'mezepheles',
  'imp',
  'sentinel', 'spirit-of-ivory',
];

describe('buildScriptContext — full roster', () => {
  const ctx = buildScriptContext(ROSTER_A, charById);

  it('returns a plain object', () => {
    expect(ctx).toBeDefined();
    expect(typeof ctx).toBe('object');
    expect(ctx.constructor).toBe(Object);
  });

  it('team counts are correct', () => {
    // slayer, empath, chef → 3 TF; heretic, recluse → 2 OS; poisoner+witch+mezepheles → 3 MIN; imp → 1 DEM
    // sentinel + spirit-of-ivory are fabled and not counted
    expect(ctx.townsfolkCount).toBe(3);
    expect(ctx.outsiderCount).toBe(2);
    expect(ctx.minionCount).toBe(3);
    expect(ctx.demonCount).toBe(1);
  });

  it('droizonDensity counts misinfo sources only', () => {
    // poisoner (lint.misinfo=true) + witch (lint.misinfo=true) = 2
    expect(ctx.droizonDensity).toBe(2);
  });

  it('confirmationCluster contains hard-confirmation roles', () => {
    expect(ctx.confirmationCluster).toBeInstanceOf(Set);
    // slayer is the only hard-confirmation role in ROSTER_A
    expect(ctx.confirmationCluster.has('slayer')).toBe(true);
    expect(ctx.confirmationCluster.size).toBe(1);
  });

  it('executionSurvivalCluster is empty when no exec-survival roles present', () => {
    expect(ctx.executionSurvivalCluster).toBeInstanceOf(Set);
    expect(ctx.executionSurvivalCluster.size).toBe(0);
  });

  it('minionVolumeScore reflects minion volume spread', () => {
    // poisoner=silent(0), witch=pseudosilent(1), mezepheles=loud(4)
    expect(ctx.minionVolumeScore.min).toBe(0);   // silent
    expect(ctx.minionVolumeScore.max).toBe(4);   // loud
    expect(ctx.minionVolumeScore.spread).toBe(4);
    expect(ctx.minionVolumeScore.tiers).toContain('silent');
    expect(ctx.minionVolumeScore.tiers).toContain('pseudosilent');
    expect(ctx.minionVolumeScore.tiers).toContain('loud');
    expect(ctx.minionVolumeScore.tiers).toHaveLength(3);
  });

  it('boolean flags are correct', () => {
    expect(ctx.hasAtheist).toBe(false);
    expect(ctx.hasHeretic).toBe(true);
    expect(ctx.hasSentinel).toBe(true);
    expect(ctx.hasSpiritOfIvory).toBe(true);
  });
});

// Test roster B — execution-survival roles + atheist.
// fool: TF, confirmations mode='execution' (v2.1-tagged) → executionSurvivalCluster
// sailor: TF, confirmations mode='execution' (v2.1-tagged) → executionSurvivalCluster
// pacifist: TF, no mode='execution' in data → caught by EXEC_SURVIVAL_FALLBACK
// atheist: TF → hasAtheist=true
const ROSTER_B = ['fool', 'sailor', 'pacifist', 'atheist', 'imp', 'poisoner', 'witch', 'baron'];

describe('buildScriptContext — execution-survival and atheist', () => {
  const ctx = buildScriptContext(ROSTER_B, charById);

  it('executionSurvivalCluster includes fool, sailor (data path) and pacifist (fallback)', () => {
    expect(ctx.executionSurvivalCluster.has('fool')).toBe(true);
    expect(ctx.executionSurvivalCluster.has('sailor')).toBe(true);
    expect(ctx.executionSurvivalCluster.has('pacifist')).toBe(true);
    expect(ctx.executionSurvivalCluster.size).toBe(3);
  });

  it('confirmationCluster includes fool, sailor, pacifist (all hard-confirmation roles)', () => {
    expect(ctx.confirmationCluster.has('fool')).toBe(true);
    expect(ctx.confirmationCluster.has('sailor')).toBe(true);
    expect(ctx.confirmationCluster.has('pacifist')).toBe(true);
  });

  it('hasAtheist is true when atheist is in roster', () => {
    expect(ctx.hasAtheist).toBe(true);
  });

  it('hasHeretic and hasSentinel are false when not in roster', () => {
    expect(ctx.hasHeretic).toBe(false);
    expect(ctx.hasSentinel).toBe(false);
  });
});

// Test roster C — minimal (no special characters).
const ROSTER_C = ['empath', 'chef', 'imp'];

describe('buildScriptContext — minimal roster', () => {
  const ctx = buildScriptContext(ROSTER_C, charById);

  it('droizonDensity is zero', () => {
    expect(ctx.droizonDensity).toBe(0);
  });

  it('confirmationCluster is empty', () => {
    expect(ctx.confirmationCluster.size).toBe(0);
  });

  it('executionSurvivalCluster is empty', () => {
    expect(ctx.executionSurvivalCluster.size).toBe(0);
  });

  it('minionVolumeScore returns null-safe defaults', () => {
    expect(ctx.minionVolumeScore.min).toBeNull();
    expect(ctx.minionVolumeScore.max).toBeNull();
    expect(ctx.minionVolumeScore.spread).toBe(0);
    expect(ctx.minionVolumeScore.tiers).toHaveLength(0);
  });

  it('minionCount is zero', () => {
    expect(ctx.minionCount).toBe(0);
  });

  it('all boolean flags are false', () => {
    expect(ctx.hasAtheist).toBe(false);
    expect(ctx.hasHeretic).toBe(false);
    expect(ctx.hasSentinel).toBe(false);
    expect(ctx.hasSpiritOfIvory).toBe(false);
  });
});

// ─── jinxCount ────────────────────────────────────────────────────────────────

describe('buildScriptContext — jinxCount', () => {
  it('is 0 when no jinxed pairs are on the roster', () => {
    const ctx = buildScriptContext(['empath', 'chef', 'imp'], charById);
    expect(ctx.jinxCount).toBe(0);
  });

  it('is 1 when exactly one jinxed pair is on the roster', () => {
    // alchemist + boffin is one mechanical jinx pair
    const ctx = buildScriptContext(['alchemist', 'boffin', 'imp'], charById);
    expect(ctx.jinxCount).toBe(1);
  });

  it('is 2 when two jinxed pairs share a character', () => {
    // heretic + baron = 1 jinx; heretic + godfather = 1 jinx → total 2
    const ctx = buildScriptContext(['heretic', 'baron', 'godfather', 'imp'], charById);
    expect(ctx.jinxCount).toBe(2);
  });

  it('counts independent pairs correctly', () => {
    // alchemist+boffin and slayer+lleech are independent pairs → 2
    const ctx = buildScriptContext(['alchemist', 'boffin', 'slayer', 'lleech', 'imp'], charById);
    expect(ctx.jinxCount).toBeGreaterThanOrEqual(2);
  });
});

// ─── hasOutsiderObfuscation — oHide path ─────────────────────────────────────

describe('buildScriptContext — hasOutsiderObfuscation via oHide', () => {
  it('is true when a character with lint.oHide is on the roster (drunk)', () => {
    const ctx = buildScriptContext(['drunk', 'imp'], charById);
    expect(ctx.hasOutsiderObfuscation).toBe(true);
  });

  it('is true when a character with lint.oHide is on the roster (lunatic)', () => {
    const ctx = buildScriptContext(['lunatic', 'imp'], charById);
    expect(ctx.hasOutsiderObfuscation).toBe(true);
  });

  it('is false for a roster with neither oMod nor oHide characters', () => {
    const ctx = buildScriptContext(['empath', 'chef', 'imp'], charById);
    expect(ctx.hasOutsiderObfuscation).toBe(false);
  });
});

// ─── minionVolumeScore — single minion ───────────────────────────────────────

describe('buildScriptContext — minionVolumeScore with one minion', () => {
  it('spread is 0 and min === max when only one minion is on the roster', () => {
    // poisoner has lint.volume = 'silent' (tier value 0)
    const ctx = buildScriptContext(['poisoner', 'imp'], charById);
    expect(ctx.minionVolumeScore.min).toBe(ctx.minionVolumeScore.max);
    expect(ctx.minionVolumeScore.spread).toBe(0);
    expect(ctx.minionVolumeScore.tiers).toHaveLength(1);
  });

  it('tiers contains the single minion volume label', () => {
    const ctx = buildScriptContext(['poisoner', 'imp'], charById);
    expect(ctx.minionVolumeScore.tiers[0]).toBe('silent');
  });
});
