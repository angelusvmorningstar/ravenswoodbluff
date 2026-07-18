# Script + character data integrity

How the nine-script set's data is kept from drifting. Enforced by `src/__tests__/data-integrity.test.js` (runs in `npm test`).

## Canonical character-id form

**Hyphenated kebab-case, exactly as `src/data/characters.json` defines each `id`** — e.g. `bounty-hunter`, `plague-doctor`, `lord-of-typhon`, `tea-lady`, `lil-monsta`.

- `src/data/my-scripts.json` and `src/data/scripts/<id>.json` use this canonical form.
- `jsons/<Name>.json` (the legacy build source) uses a **no-hyphen** form (`bountyhunter`, `plaguedoctor`). This is legacy only; the integrity test compares it hyphen-insensitively. New data should prefer the canonical form. Migrating `jsons/` + `build-my-scripts.py` to canonical ids would remove the last dual-format source (future work).

## The three roster locations (must never disagree)

| File | Role | Id form |
|---|---|---|
| `jsons/<Name>.json` | build source read by `scripts/build-my-scripts.py` | no-hyphen (legacy) |
| `src/data/my-scripts.json` | canonical runtime artefact loaded by `builder.js` | canonical |
| `src/data/scripts/<id>.json` | per-script preset (picker + analyser detail) | canonical |

`build-my-scripts.py` regenerates `my-scripts.json` from `jsons/`, so editing one place without the others lets a rebuild silently revert design work. **Any edit to a roster must update all three** (or run the reconciliation the way the 2026-07-18 fix did). The integrity test fails on any divergence.

## Invariants the test enforces (per script)

- Every id is canonical kebab-case AND exists in `characters.json` (no typos, no non-canonical ids).
- No duplicate characters.
- **No Fabled** (the set's hard constraint).
- No Travellers / non-official teams in a composition.
- Team composition is **13 townsfolk / 4 outsider / 4 minion / N demon** (N = 2 for Gentle Night, else 4).
- `jsons/` source and `src/data/scripts/` preset agree with `my-scripts.json` (the drift guard).

## Set-level invariant

- **Full official coverage:** every official character (138: townsfolk + outsider + minion + demon) is used at least once across the nine.

See also `_bmad-output/planning-artifacts/nine-script-set-requirements.md` for the set's design goals and priority.
