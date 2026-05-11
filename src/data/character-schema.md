# Character Schema v2.1

Reference document for the `characters-v2.1.json` overlay database. Defines all character fields, naming conventions, the `confirmations[]` sub-object, v2_1_status semantics, and resolutions to nine v1 schema conflicts.

**Source of truth for field definitions:** `D:\Clocktower\Script Building Info.md` Sections 2-2.7 (tagging tables in Section 2.7 per-batch).

---

## Naming Conventions

Existing v1 fields inside the `lint{}` object use **camelCase** (e.g. `misinfo`, `oMod`, `extraEvil`). They are preserved verbatim and continue to be read by v1-era rules.

All new v2.1 fields added outside the `lint{}` object use **snake_case** (e.g. `v2_1_status`, `wincon_alt`, `even_if_dead_persistence`). This matches the corpus vocabulary directly.

The naming split is intentional and documented: migrating existing v1 field names would break backwards compatibility with `analyser.js` and require a coordinated rename across the character data and engine simultaneously. v2.2 may unify the naming; for now, the split is load-bearing.

---

## v1 Fields Preserved Verbatim (inside `lint{}`)

These fields live inside the character's `lint` sub-object. They are read by the v1 engine (`analyser.js`) and by v1-compatibility rules in `analyser-v2.1.js`. Do not rename or restructure them.

| Field | Type | Rules that consume it | Purpose |
|---|---|---|---|
| `misinfo` | `boolean` | E02, W06, W07, N02 | Character is an evil-side misinformation source |
| `misinfoShape` | `"targeted" \| "persistent-column" \| "horizontal" \| "arbitrary"` | W11, N02 | Hystrex misinfo-shape classification |
| `oMod` | `"+2" \| "+1" \| "-1" \| "variable"` | E03 | Outsider count modifier at setup |
| `oHide` | `boolean` | E03 | Hides or obfuscates Outsider count |
| `extraEvil` | `"strong" \| "soft"` | E05, E07 | Extra evil player source (strong = guaranteed) |
| `grimpeekerNeeded` | `boolean` | W01 | Info role that needs a Spy/Widow bluff cover |
| `grimpeeker` | `boolean` | W01 | Can see the Grimoire (Spy/Widow) |
| `powerRole` | `boolean` | (v1 W02 — see Conflict 1 below) | v1 execution-survival flag; deprecated in v2.1 |
| `powerCounterpart` | `string[]` | (v1 W02 — see Conflict 1) | v1 proc-confounder ID list; deprecated in v2.1 |
| `confirmationRole` | `boolean` | (not read — see Conflict 2) | v1 confirmation presence flag; inert in v2.1 |
| `confirmationCounterpart` | `string[]` | (v1 W03 for Mayor — see Conflict 3) | v1 claim-confounder list; deprecated in v2.1 |
| `shabalothCounterpart` | `boolean` | W04 | Can fake a resurrection |
| `volume` | `"silent" \| "pseudosilent" \| "one-good-knows" \| "confoundable" \| "loud"` | W05 | Hystrex Minion loudness tier |
| `deadCanBeEvil` | `boolean` | W08 | Dead player can become or be evil |
| `loudDemon` | `boolean` | W09 | Demon is inherently self-revealing |
| `vortoxFlag` | `boolean` | W10 | Script-warping role (Vortox, Atheist) |
| `nonconformistInfo` | `boolean` | W13 | Artist/Savant-style non-standard info |
| `misregistration` | `boolean` | W13 | Recluse/Spy/Lycanthrope-style register effects |
| `mathematicianLoad` | `boolean` | (informational notices) | Creates abnormal events loading Mathematician count |

All characters with no relevant v1 tags have no `lint` field at all.

---

## v2.1 Top-Level Fields (new, snake_case)

These fields are added directly on the character object (not inside `lint{}`).

| Field | Type | Rules | Corpus section | Notes |
|---|---|---|---|---|
| `v2_1_status` | `"verified" \| "inherited_from_v2" \| "pending"` | Engine gate (`hasV2Tagging()`) | Throughout | See semantics below |
| `confirmations` | `ConfirmationEntry[]` | E08, E11, W01, W14-W16, N04, N05 | 2.1-2.6 | See sub-object schema below |
| `wincon_alt` | `string \| undefined` | N06 | 6 (Win Conditions) | e.g. `"atheist"`, `"alsaahir"`, `"cult_leader"` |
| `v2_section_refs` | `string[]` | Reference only | Throughout | Section numbers where character is discussed |
| `v2_open_questions` | `number[]` | Epic 4 OQ surfacing | 22 | Section 22 OQ numbers triggered by this character |
| `jinxes` | `JinxRef[]` | Epic 4 jinx module | 11.2 | Cross-reference to canonical jinx pairs (see below) |

### JinxRef sub-object

```json
{
  "partner_id": "string (kebab-case)",
  "sub_type": "mechanical-patch | hate | info-amplifying | wincon-modifying | setup-transparency-altering",
  "canonical_text": "string (from Section 11.2)"
}
```

---

## The `confirmations[]` Array

A character may have zero or more confirmation entries. Each entry represents one distinct confirmation mode (e.g. Tea Lady has separate execution-survival and night-protection modes).

```json
{
  "type": "hard | soft | load_bearing_soft | info",
  "mode": "string (optional)",
  "signature": "string (human-readable description)",
  "proc_confounders": [{ "id": "kebab-id", "partial": false }],
  "claim_confounders": [{ "id": "kebab-id", "partial": false }],
  "info_bluff_cover": [{ "id": "kebab-id" }],
  "section_ref": "string"
}
```

### `type` values

| Value | Meaning | Engine rule |
|---|---|---|
| `"hard"` | Produces public, mechanically verifiable confirmation. Cannot be undermined without a proc-confounder present. | E08 — error if no proc-confounder on script |
| `"soft"` | Produces observable evidence but not mechanically verifiable. No script-level error. | Informational notices |
| `"load_bearing_soft"` | Soft confirmation that is disproportionately hard to undermine without a claim-confounder. Currently: Mayor. | E11 — error if no claim-confounder on script |
| `"info"` | Info role whose information breadth needs bluff cover. | W01 — warning if no `info_bluff_cover` member on script |

### `mode` values (optional)

Used when a character has two confirmation modes. Common values:
- `"execution"` / `"night"` — Tea Lady, Sailor, Fool (execution-survival vs night-protection modes)
- `"claim"` — Mayor's load-bearing soft confirmation

### `proc_confounders` and `claim_confounders`

Arrays of `{ id, partial }` objects.

- `id` — kebab-case character ID
- `partial: true` — this character only partially covers the confirmation (e.g. Lleech partially covers execution-survival; presence degrades E08 to W14 rather than silencing the error entirely)
- `partial: false` (default) — full coverage

### `info_bluff_cover`

Array of `{ id }` objects. Characters that provide grimoire-peek bluff cover for info roles. Currently: Spy, Widow. Extends the v1 `grimpeekerNeeded`/`grimpeeker` pattern with per-character specificity.

---

## Ability-Shape Fields (v2.1, snake_case)

These fields are defined by the corpus's Section 2.7 per-batch tagging tables. They are not yet consumed by any implemented rule; they will be read by informational-tier rules in Epic 2. Listed here for completeness and to prevent future naming conflicts.

For full definitions and per-character values, read `D:\Clocktower\Script Building Info.md` Section 2.7.

| Field | Introduced | Brief definition |
|---|---|---|
| `signature_breadth` | Batch 3 | Protection breadth: `"demon_only"` or `"any_death"` |
| `is_drunkenness_source` | Batch 3 | Good-aligned droison source (sub-typed: `setup_self_droison`, `nightly_droison`, etc.) |
| `informs_demon_identity` | Batch 3 | Role tells the Demon who the role-bearer is on proc |
| `kill_attribution_confound` | Batch 3 | Adds noise to kill-source deductions |
| `proc_is_st_discretionary` | Batch 3 | Proc fires at ST discretion (Pacifist, Mutant) |
| `retroactive_soft_confirmation` | Batch 3 | Evidence appears one phase after ability use (Gambler) |
| `posthumous_confirmation` | Batch 4 | Public alignment confirmation after role-bearer dies |
| `triggers_on_death` | Batch 4 | Ability fires on death (sub-typed: `own_death`, `related_death`, etc.) |
| `behaviour_detection` | Batch 4 | Detects player behaviour rather than character/alignment |
| `re_triggers_on_resurrection` | Batch 4 | Re-runs N1 ability on mid-game role creation |
| `built_in_confound` | Batch 5 | Info includes a known-false element (Dreamer, Fortune Teller) |
| `vortox_detector` | Batch 5 | Role can detect Vortox via impossible-result reasoning |
| `st_crafted_info` | Batch 5 | ST has unusual creative authority over info content |
| `alignment_swap` | Batch 5 | Role swaps alignments mid-game (Snake Charmer) |
| `alignment_comparison` | Batch 5 | Info shape is same/different alignment (Seamstress) |
| `delayed_info` | Batch 5 | Info delivered one phase after action (Juggler) |
| `day_phase_info` | Batch 5 | Info gathering happens during the day phase |
| `wincon_rewriting_role` | Batch 6a | Rewrites entire win-condition space (Atheist) |
| `setup_modifying_role` | Batch 6a | Forces setup changes (sub-typed: `setup_adds_evil`, etc.) |
| `mid_game_setup_modifier` | Batch 6a | Modifies setup composition mid-game (Engineer) |
| `jinx_burden` | Batch 6a | Integer count of canonical jinxes for this role |
| `start_knowing_info_shape` | Batch 6b | Enum: shape of start-knowing info (e.g. `paired_character_ping`) |
| `each_night_info_shape` | Batch 6c | Enum: shape of each-night info (e.g. `count_in_neighbourhood`) |
| `setup_misregister_source` | Batch 6c | Causes another player to misregister at setup |
| `is_ability_disable_source` | Batch 6c | Disables another role's ability |
| `ability_acquisition` | Batch 6b | Gains another role's ability (sub-typed) |
| `wincon_alt_path` | Batch 6d | Additional good-win path alongside standard kill-Demon |
| `multi_instance_role` | Batch 6d | Role can be in play in multiple instances |
| `post_death_voting_power` | Batch 6e | Retains voting/nominating ability while dead |
| `is_passive_handicap_outsider` | Batch 7a | Outsider with no active ability — pure handicap |
| `is_setup_deception_role` | Batch 7a | Deceives own player about their identity at setup |
| `even_if_dead_persistence` | Batch 7a | Effect persists after death (Recluse, Sweetheart) |
| `team_aware_wincon_mechanic` | Batch 7a | Wiki explicitly handles alignment-flux in wincon clause |
| `vote_restriction_role` | Batch 7a | Mechanically restricts voting (Butler) |
| `info_flow_to_evil` | Batch 7b | Good role's info or actions visible to evil |
| `is_might_clause` | Batch 11 | ST-discretionary outcome (canonical "Might" wording) |
| `seating_constraint` | Batch 11 | Sub-typed neighbour-targeting constraint |

---

## `v2_1_status` Semantics

| Value | Meaning | Engine behaviour |
|---|---|---|
| `"verified"` | Character fully tagged against the complete 12-batch corpus (`Script Building Info.md`). All applicable v2.1 fields are populated and cross-checked. | v2.1 rules fire normally |
| `"inherited_from_v2"` | Character was tagged during the 4-batch partial corpus run. Fields may be incomplete or incorrect. Treated as provisional until re-verified against the full 12-batch corpus. | v2.1 rules fire normally (same as verified) |
| `"pending"` | Character has not been tagged yet. | v2.1 rules are silently skipped; v1 rules continue to fire |

Characters with no `v2_1_status` field at all are treated as `"pending"` by the engine.

---

## Fail-Open Policy for Untagged Characters

The engine's `hasV2Tagging(char)` helper returns `true` only when `v2_1_status` is `"verified"` or `"inherited_from_v2"`. When a character does not pass this gate:

- **v2.1 rules** (those reading `confirmations[]`, `wincon_alt`, `even_if_dead_persistence`, etc.) are **silently skipped** for that character. No error is thrown, no false positive fires.
- **v1 rules** (those reading `lint.*` fields) **continue to fire normally** regardless of `v2_1_status`.

This is fail-open: the engine degrades gracefully to v1 behaviour for untagged characters rather than failing closed. The policy means partial database coverage (e.g. during Epic 1 story-by-story population) does not break the engine or produce spurious errors.

---

## v1 Schema Conflict Resolutions

Nine v1 schema patterns conflict with the v2.1 confirmation taxonomy. None are silently reconciled; each is documented here.

### Conflict 1: `powerRole` conflates execution-survival with night-survival

**v1 problem:** `lint.powerRole: true` is set on Soldier (night-survival only), Mayor (load-bearing soft), and Tea Lady (dual-mode). The v1 rule W02 labels these uniformly as "execution-survival" which is wrong for Soldier and inappropriate for Mayor.

**v2.1 resolution:** `powerRole` and `powerCounterpart` are deprecated as authoritative fields. New `confirmations[]` entries with typed `type` values replace them. Soldier gets a `soft` confirmation entry (no script-level error; W02 does not fire). Mayor gets a `load_bearing_soft` entry with `claim_confounders`. Execution-survival roles (Sailor, Fool, Pacifist, Tea Lady execution-mode) get `hard` entries with `proc_confounders`.

The `lint.powerRole` and `lint.powerCounterpart` fields remain on characters that carry them (backwards compatibility with `analyser.js`) but are not read by `analyser-v2.1.js` rules.

### Conflict 2: `confirmationRole` is structurally inert

**v1 problem:** `lint.confirmationRole: true` is set on roughly the right characters but is never read by any rule in the v1 engine.

**v2.1 resolution:** The flag is a dead field. It is not added to new character entries. `confirmations[].type` is the v2.1 authority on confirmation classification.

### Conflict 3: `powerCounterpart` / `confirmationCounterpart` shadow lists

**v1 problem:** Several characters (Mayor, Sailor, Fool, Pacifist, Tea Lady) carry both `powerCounterpart` and `confirmationCounterpart` with overlapping or contradictory lists.

**v2.1 resolution:** `confirmations[].proc_confounders` is the authority for hard-confirmation counterparts. `confirmations[].claim_confounders` is the authority for load-bearing-soft counterparts. Both v1 fields remain on characters that carry them; `analyser-v2.1.js` reads only the v2.1 fields.

### Conflict 4: Slayer not flagged as a confirmation role

**v1 problem:** Slayer's `characters.json` entry has no `lint` block. The v1 engine has no Slayer-specific rule.

**v2.1 resolution:** Slayer is a hard-confirmation role per Section 2.1 of the corpus. It gets a `confirmations` entry with `type: "hard"` and `proc_confounders: [spy, widow, recluse, boffin]` (Spy/Recluse misregister as good, Widow reads Grimoire, Boffin can grant the Slayer ability to a non-Slayer). The partial scaffold (`characters-v2.1.json`) already contains this entry; verify it against the full corpus in Story 1.3.

### Conflict 5: Virgin not flagged

**v1 problem:** Same situation as Slayer — no `lint` block in `characters.json`.

**v2.1 resolution:** Virgin is a hard-confirmation role per Section 2.1. It gets a `confirmations` entry with `type: "hard"` and `proc_confounders: [spy, widow]`. The partial scaffold already contains this entry; verify in Story 1.3.

### Conflict 6: Boffin and Drunk not flagged as generic confirmation counterparts

**v1 problem:** Section 2.5 of the corpus formalises Boffin and Drunk as generic confirmation counterparts (Boffin can grant any ability, Drunk silently poisons any role's proc). The v1 schema has no field for this.

**v2.1 resolution:** A top-level `is_generic_confirmation_counterpart: boolean` field is added to Drunk and Boffin. The analyser reads this in rules that check "does any generic counterpart cover this confirmation?" Note: Boffin's generic coverage has a caveat — it only applies when a given character's ability is assigned to the Demon, which depends on bag composition. This caveat is noted in Boffin's entry via a `generic_counterpart_caveat` string field.

### Conflict 7: Tea Lady dual mode is unrepresented

**v1 problem:** Tea Lady has a single `powerRole: true` entry. The v1 schema cannot represent that Tea Lady has one behaviour in execution context (hard-confirmation: neighbours cannot be executed) and a different behaviour in night context (soft-confirmation: protects living neighbours from night kills).

**v2.1 resolution:** Tea Lady has two `confirmations[]` entries:
1. `{ type: "hard", mode: "execution", proc_confounders: [devils-advocate, ...] }`
2. `{ type: "soft", mode: "night" }`

Rules dispatch on `mode` when needed (W17 checks only the night mode for protection coverage).

### Conflict 8: Lleech not flagged as partial execution-survival counterpart

**v1 problem:** Lleech partially covers execution-survival claims (if Lleech is attached to a player, executing that player may not result in a clean death — the attached Lleech host survives). The v1 schema has no way to represent partial coverage.

**v2.1 resolution:** Lleech appears in the `proc_confounders` list of execution-survival `confirmations[]` entries with `partial: true`. When only Lleech is present as a proc-confounder, the engine fires W14 (partial coverage warning) rather than E08 (missing proc-confounder error).

### Conflict 9: Bounty Hunter dual nature

**v1 problem:** Bounty Hunter is simultaneously a "good-ping" Townsfolk (info about who turns evil) and a Mayor claim-confounder (makes a Townsfolk evil, eroding trust in the claim). The v1 schema has no place for this duality.

**v2.1 resolution:** Bounty Hunter carries both:
- `lint.extraEvil: "strong"` (preserved from v1 — it is an extra-evil source)
- An entry in Mayor's `confirmations[].claim_confounders` list (it undermines the Mayor claim by introducing an unknown evil Townsfolk)

The role does not carry a `confirmations[]` entry itself; it acts as a counterpart to other roles rather than having its own confirmation signature.

---

## File List

| File | Role |
|---|---|
| `src/data/character-schema.md` | This document — human-readable schema reference |
| `src/data/characters.json` | Canonical production database — NOT modified by v2.1 work |
| `src/data/characters-v2.1.json` | v2.1 overlay — all new schema fields live here |
| `src/js/analyser.js` | v1 engine — reads only `lint.*` fields |
| `src/js/analyser-v2.1.js` | v2.1 engine — reads both `lint.*` and v2.1 fields |
