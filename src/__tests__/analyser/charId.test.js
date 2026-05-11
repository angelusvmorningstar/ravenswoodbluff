import { describe, it, expect } from 'vitest';
import { normaliseCharId } from '../../js/utils/charId.js';

describe('normaliseCharId', () => {
  // AC2 — specified conversions
  it("strips apostrophes", () => {
    expect(normaliseCharId("devil's-advocate")).toBe("devils-advocate");
  });

  it("replaces underscores with hyphens", () => {
    expect(normaliseCharId("lil_monsta")).toBe("lil-monsta");
    expect(normaliseCharId("devils_advocate")).toBe("devils-advocate");
  });

  it("replaces spaces with hyphens", () => {
    expect(normaliseCharId("tea lady")).toBe("tea-lady");
  });

  it("lowercases the result", () => {
    expect(normaliseCharId("Tea-Lady")).toBe("tea-lady");
  });

  // AC3 — NFR3 edge cases: canonical IDs pass through unchanged
  it("passes through already-canonical IDs unchanged", () => {
    expect(normaliseCharId("devil-s-advocate")).toBe("devil-s-advocate");
    expect(normaliseCharId("lil-monsta")).toBe("lil-monsta");
    expect(normaliseCharId("tea-lady")).toBe("tea-lady");
  });

  it("applies all transformations together (uppercase + apostrophe + space)", () => {
    expect(normaliseCharId("Devil's Advocate")).toBe("devils-advocate");
  });
});
