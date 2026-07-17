// Script analyser. Reads characters.json extended fields (confirmations[],
// setup_alters, wincon_alt, generic_confirmation_counterpart) plus all lint.*
// fields. Characters whose status is missing or "pending" are skipped by rules
// that depend on extended data.
//
// Rule numbering follows corpus Section 21.

import jinxes from '../data/jinxes.json';
import openQuestions from '../data/open-questions.json';
import { normaliseCharId } from './utils/charId.js';

/**
 * @typedef {{ rule: string, message: string, characters?: string[] }} Finding
 */

const VOLUME_TIER = {
  silent: 0,
  pseudosilent: 1,
  'one-good-knows': 2,
  confoundable: 3,
  loud: 4,
};

/**
 * @param {object} char
 * @returns {boolean}
 */
function hasV2Tagging(char) {
  return char?.status === 'verified' || char?.status === 'inherited';
}

/**
 * Counterpart entries are objects { id, partial?, condition?, notes? }.
 * "Satisfied" means at least one non-partial counterpart is on script,
 * OR a partial counterpart is on script (which still counts but produces a warning).
 */
function counterpartStatus(counterparts, selectedIds) {
  const present = counterparts.filter(c => selectedIds.has(c.id));
  if (present.length === 0) return { satisfied: false, partial: false, present: [] };
  const hasFull = present.some(c => !c.partial);
  return { satisfied: true, partial: !hasFull, present };
}

const EXEC_SURVIVAL_FALLBACK = new Set(['sailor', 'fool', 'pacifist']);

/**
 * Pass 1: aggregate script-level context for O(1) lookup by Pass 2 rules.
 * @param {string[]} roster — array of kebab-case character IDs
 * @param {Map<string, object>} charById — character ID → character entry
 * @returns {object} plain scriptContext object (no class instances, no circular refs)
 */
export function buildScriptContext(roster, charById) {
  const selectedIds = new Set(roster);
  const chars = roster.map(id => charById.get(id)).filter(Boolean);

  const townsfolkCount = chars.filter(c => c.team === 'townsfolk').length;
  const outsiderCount  = chars.filter(c => c.team === 'outsider').length;
  const minionCount    = chars.filter(c => c.team === 'minion').length;
  const demonCount     = chars.filter(c => c.team === 'demon').length;

  const droizonDensity = chars.filter(c => c.lint?.misinfo === true).length;

  const hasOutsiderObfuscation = chars.some(c => c.lint?.oMod || c.lint?.oHide);
  const hasExtraEvil           = chars.some(c => c.lint?.extraEvil);
  const strongEvilRoles        = chars.filter(c => c.lint?.extraEvil === 'strong').map(c => c.id);

  const confirmationCluster = new Set(
    chars
      .filter(c => hasV2Tagging(c) && (c.confirmations ?? []).some(conf => conf.type === 'hard'))
      .map(c => c.id)
  );

  const executionSurvivalCluster = new Set(
    chars
      .filter(c =>
        (hasV2Tagging(c) && (c.confirmations ?? []).some(conf => conf.mode === 'execution')) ||
        EXEC_SURVIVAL_FALLBACK.has(c.id)
      )
      .map(c => c.id)
  );

  const minionCharsWithVol = chars.filter(
    c => c.team === 'minion' && c.lint?.volume && VOLUME_TIER[c.lint.volume] !== undefined
  );
  let minionVolumeScore;
  if (minionCharsWithVol.length === 0) {
    minionVolumeScore = { min: null, max: null, spread: 0, tiers: [] };
  } else {
    const tierValues = minionCharsWithVol.map(c => VOLUME_TIER[c.lint.volume]);
    const minVal = Math.min(...tierValues);
    const maxVal = Math.max(...tierValues);
    const tiers = [...new Set(minionCharsWithVol.map(c => c.lint.volume))];
    minionVolumeScore = { min: minVal, max: maxVal, spread: maxVal - minVal, tiers };
  }

  const jinxCount = jinxes.filter(j => j.characters.every(id => selectedIds.has(id))).length;

  return {
    droizonDensity,
    hasOutsiderObfuscation,
    hasExtraEvil,
    strongEvilRoles,
    jinxCount,
    confirmationCluster,
    executionSurvivalCluster,
    minionVolumeScore,
    demonCount,
    minionCount,
    outsiderCount,
    townsfolkCount,
    hasAtheist:       selectedIds.has('atheist'),
    hasHeretic:       selectedIds.has('heretic'),
    hasSentinel:      selectedIds.has('sentinel'),
    hasSpiritOfIvory: selectedIds.has('spirit-of-ivory'),
  };
}

// ─── Pass 2: Rule Functions and Runner ───────────────────────────────────────

// Every finding carries `kind` (verdict | advisory | reflection) and a first-class,
// nullable `provenance`. Mechanical rules are all `kind: 'verdict'` with `provenance: null`;
// the qualitative layer (v3) is the only source of advisory/reflection kinds and of a
// non-null provenance. The pass/fail path filters `kind === 'verdict'`, so the qualitative
// layer is structurally incapable of gating a script. See Section 24.16.
function makeScriptFinding(rule_id, severity, message, characters = [], missing_mitigations = [], noticeText = '', explainerText = '') {
  return {
    rule: rule_id, message, characters,
    type: 'script', rule_id, severity,
    kind: 'verdict', provenance: null,
    notice_text: noticeText, explainer_text: explainerText,
    affected_characters: [...characters],
    missing_mitigations,
  };
}

function makeCharFinding(rule_id, severity, message, characters = [], missing_mitigations = [], noticeText = '', explainerText = '') {
  return {
    rule: rule_id, message, characters,
    type: 'character', rule_id, severity,
    kind: 'verdict', provenance: null,
    notice_text: noticeText, explainer_text: explainerText,
    affected_characters: [...characters],
    missing_mitigations,
  };
}

// Advisory findings (kind: 'advisory') are the qualitative layer's observations. They carry
// severity: null and a provenance tag, and they are routed to their own `advisories` stream —
// never into errors/warnings/notices, so they can never gate a script (Section 24.16, story v3.1).
// `value` is an optional numeric readout for the Fingerprint stat display (story v3.2 / C6).
function makeAdvisory(rule_id, message, { provenance = null, noticeText = '', explainerText = '', value = null, characters = [] } = {}) {
  return {
    rule: rule_id, message, characters,
    type: 'script', rule_id, severity: null,
    kind: 'advisory', provenance, value,
    notice_text: noticeText, explainer_text: explainerText,
    affected_characters: [...characters],
    missing_mitigations: [],
  };
}

export function ruleE02(roster, scriptContext) {
  if (scriptContext.droizonDensity !== 0) return null;
  return makeScriptFinding(
    'E02', 'hard_error',
    'No misinfo source on this script. Townsfolk will always receive accurate night information.',
    [], [],
    'No droison source',
    'A droison source is any role that gives Townsfolk false night information — Poisoner, Widow, and similar. Without one, every Townsfolk on the script receives accurate information every night and the good team can build a reliable picture of the game through deduction alone. This leaves the Demon almost nowhere to hide once good players compare notes. Almost every playable script includes at least one droison source; scripts without misinfo are structurally unsound for competitive play.'
  );
}

export function ruleW12(roster, scriptContext) {
  if (!(scriptContext.hasHeretic === true && scriptContext.hasSentinel === false)) return null;
  return makeCharFinding(
    'W12', 'soft_warning',
    'Heretic is on the script without Sentinel Fabled. Good players win regardless of outcome.',
    ['heretic'], [],
    'Heretic on script without Sentinel Fabled',
    'Heretic reverses the win condition: good wins if Heretic is executed, evil wins if they aren\'t. This creates a unique dynamic where execution interests are inverted. Because Heretic dramatically changes the game\'s win path, a Storyteller may occasionally need to remove it mid-game if its presence causes an irrecoverable session. Sentinel Fabled provides that safety valve, allowing the Storyteller to remove characters from play when needed. Without Sentinel, there is no canonical mechanism to correct a Heretic game that goes badly wrong.'
  );
}

export function ruleN41(roster, scriptContext, charById) {
  if (scriptContext.confirmationCluster.size < 3) return null;
  return makeScriptFinding(
    'N41', 'informational',
    'Confirmation cluster density is elevated — 3 or more hard-confirmation roles on script.',
    [], [],
    'Confirmation cluster density elevated',
    'Hard-confirmation roles give good players a way to verify their own identity definitively — through a mechanic that produces proof rather than just information. When three or more are on the same script, the good team can triangulate evil players with unusual speed and reliability. This compresses the deduction phase and may leave the Demon with very little fog to hide in. Consider whether the evil team has enough information economy — bluffs, misregistration, or droison — to survive good\'s early clarity.'
  );
}


export function ruleN66(roster, scriptContext, charById) {
  if (scriptContext.minionVolumeScore.min === null) return null;
  if (scriptContext.minionVolumeScore.spread < 3) return null;
  return makeScriptFinding('N66', 'informational',
    'Minion volume spread is wide — noisy and quiet Minions on the same script create uneven information economy.',
    [], [],
    'Minion volume spread is wide',
    'Volume in BotC measures how audible a Minion\'s presence is. The volumes are:\n\nSilent — operates invisibly; its presence is undetectable by normal play.\nPseudosilent — silent except to one or two players, or proxy-loud through Demon behaviour.\nOne-good-knows — reveals itself to a single good player.\nConfoundable — loud unless paired with specific characters that explain away its effects.\nLoud — its presence is obvious to an attentive good team.\n\nWhen Minions span three or more volumes, it can complicate the information the good team gets, making the Minion-deduction layer of the game feel incoherent. Wide spread can be intentional, so it\'s worth double-checking your design goals.'
  );
}

export function ruleN67(roster, scriptContext, charById) {
  const grimpeekerNeededRoles = roster.filter(id => charById.get(id)?.lint?.grimpeekerNeeded === true);
  if (grimpeekerNeededRoles.length === 0) return null;
  const hasGrimpeeker = roster.some(id => charById.get(id)?.lint?.grimpeeker === true);
  if (hasGrimpeeker) return null;
  return makeCharFinding('N67', 'informational',
    'Grimoire-aware roles on script without a balancing grimoire-peek mismatch check.',
    grimpeekerNeededRoles, [],
    'Grimoire-aware roles without a Grimoire-peeker',
    'Some Townsfolk produce night information that a Demon cannot plausibly fake without knowing the exact game state — they give specifics that Minions can\'t fabricate unless they see what the Storyteller sees. Spy and Widow are the canonical Grimoire-peekers: Minions who see the full Grimoire each night, allowing the Demon to bluff these roles convincingly. Without a peeker, the Demon\'s bluffing options for these characters are constrained, because a wrong claim can be caught when the information doesn\'t match. Many scripts run without a peeker by design, but it\'s worth acknowledging the bluff-space narrowing.'
  );
}

export function ruleN68(roster, scriptContext, charById) {
  if (scriptContext.droizonDensity < 4) return null;
  return makeScriptFinding('N68', 'informational',
    "High misinfo density — 4 or more droison sources may undermine Good's information economy.",
    [], [],
    'High droison density — 4 or more misinfo sources',
    'Droison sources are roles that give Townsfolk false night information. A script with four or more means that on many nights a significant portion of the good team\'s information is unreliable. While some misinfo is healthy — it gives the evil team hiding room and keeps deduction interesting — too much can frustrate players who enjoy building a coherent picture from the night phase. Very high droison density tips the balance heavily toward evil. Confirm the level of uncertainty you\'re designing for and that the good team has enough reliable anchors to make deduction feel worthwhile.'
  );
}

export function ruleN86(roster, scriptContext, charById) {
  const findings = [];
  for (const id of roster) {
    if (charById.get(id)?.lint?.loudDemon === true) {
      findings.push(makeCharFinding('N86', 'informational',
        `${id} — loud Demon; kills/operates via day-phase or public action rather than quiet night kills.`,
        [id], [],
        `${id} — loud Demon`,
        'This Demon kills or acts during the day phase, or through public action, rather than quiet night kills. Loud Demons — Leviathan, Riot, and others — dramatically change the game\'s information structure: the Demon\'s presence or actions are known in ways that a traditional night-kill Demon avoids. Standard night-phase deduction (tracking kill patterns, correlating night information with deaths) applies differently on a loud Demon script. This is purely informational — loud Demon design is valid and produces interesting games — but Storytellers should be comfortable with the public-identity dynamics before running one.'
      ));
    }
  }
  return findings;
}

// Roles that shift what happens after a successful Demon execution — evil does not immediately lose.
// Mastermind has no deadCanBeEvil flag so is listed explicitly.
// Excluded from deadCanBeEvil sweep: imp (voluntary self-kill), vigormortis (dead Minions retain
// abilities — this is NOT a Demon-execution contingency; executing Vigormortis ends evil normally),
// lleech (execution deflection — already covered by N106 as an execution blocker, not a contingency).
const EXECUTION_CONTINGENCY_IDS = new Set(['evil-twin', 'mastermind']);
const EXECUTION_CONTINGENCY_DCE_EXCLUDED = new Set(['imp', 'vigormortis', 'lleech']);

export function ruleN87(roster, scriptContext, charById) {
  const contingencyChars = roster.filter(id =>
    EXECUTION_CONTINGENCY_IDS.has(id) ||
    (!EXECUTION_CONTINGENCY_DCE_EXCLUDED.has(id) && charById.get(id)?.lint?.deadCanBeEvil === true)
  );
  if (contingencyChars.length === 0) return null;
  return makeScriptFinding('N87', 'informational',
    `Execution contingency on script: ${contingencyChars.join(', ')}.`,
    contingencyChars, [],
    'Execution contingency on script',
    'Some roles change what happens after the Demon is successfully executed — evil does not immediately lose.\n\nEvil Twin — good cannot win while both twins are alive, so even a correct Demon execution leaves a second win condition active.\nMastermind — adds a bonus day after the Demon is executed: if any player is then executed on that extra day, their team loses. Evil tries to engineer a good execution; good must execute an evil player or avoid executing at all.\nScarlet Woman — takes over as Demon the moment the Demon dies with 5 or more players alive, handing evil a replacement immediately.\nFang Gu — can jump into an Outsider when it kills one at night; if a jump occurs, the original Fang Gu player appears to die while the Demon role transfers to a new player, leaving the good team with a false impression that the Demon has been removed.\nZombuul — appears to die but survives its first death; an execution that seems to remove the Demon may leave it still in play.\n\nMayor is a useful backstop on these scripts — if three players remain and no execution occurs, good wins, giving the good team an alternative that bypasses the contingency entirely.'
  );
}

// Roles that can prevent good from killing the Demon on the block even when correctly identified.
// N106 is a custom extension beyond the 105-notice corpus max; closest corpus notices are
// #68/#77 (execution_block_source cluster, 2+ fires). This rule fires for 1+ because any single
// execution-deflector is worth surfacing as informational. Organ Grinder and Lleech are included
// here as execution-outcome disruptors even though they differ from the corpus's execution_block_source
// schema field (DA, Pacifist, Psychopath, Vizier).
const EXECUTION_BLOCKER_IDS = new Set(['lleech', 'devils-advocate', 'organ-grinder', 'vizier']);

export function ruleN106(roster, scriptContext, charById) {
  const blockerChars = roster.filter(id => EXECUTION_BLOCKER_IDS.has(id));
  if (blockerChars.length === 0) return null;
  return makeScriptFinding('N106', 'informational',
    `Execution blocker on script: ${blockerChars.join(', ')}.`,
    blockerChars, [],
    'Execution blocker on script',
    'Some roles can prevent the good team from successfully executing the Demon even after correctly identifying it.\n\nDevil\'s Advocate — can protect the Demon from dying on the block, wasting the good team\'s execution entirely.\nLleech — redirects any execution aimed at it onto its host; the Lleech itself is never killed by execution directly.\nOrgan Grinder — causes nominations and votes to happen with eyes closed, making it difficult to coordinate a targeted execution reliably.\nVizier — can immediately execute a player without a vote, bypassing the normal execution process and denying the good team control over who dies.\n\nOn these scripts, the good team must account for the possibility that a successful-seeming execution does not remove the Demon.'
  );
}

export function ruleN88(roster, scriptContext, charById) {
  if (!roster.includes('vortox')) return null;
  return makeCharFinding('N88', 'informational',
    'Vortox on script — all Townsfolk receive false information each night; good must execute daily to win.',
    ['vortox'], [],
    'Vortox on script',
    'Vortox causes all Townsfolk to receive false night information every night — a global misinfo regime distinct from individual droison sources. Every standard night-phase deduction the good team makes is wrong, and good must execute at least one player every day or Vortox wins. This means Townsfolk who would normally anchor good\'s information (Investigator, Washerwoman, etc.) supply reliable-feeling but systematically false data. Vortox scripts require deliberate design attention and experienced Storytelling; all other analyser notices on this script should be read in the context of Vortox\'s global information inversion.'
  );
}

export function ruleE01(roster, scriptContext, charById) {
  const findings = [];
  if (scriptContext.townsfolkCount < 13)
    findings.push(makeScriptFinding('E01', 'hard_error',
      `Too few Townsfolk: script has ${scriptContext.townsfolkCount}, minimum is 13.`,
      [], [],
      'Too few Townsfolk',
      'A standard BotC script requires at least 13 Townsfolk characters to support the full player-count range. With fewer than 13, some player-count configurations cannot draw from the full Townsfolk pool and the script becomes structurally incomplete. This is a blocking requirement before publishing or play-testing.'
    ));
  if (scriptContext.outsiderCount < 4)
    findings.push(makeScriptFinding('E01', 'hard_error',
      `Too few Outsiders: script has ${scriptContext.outsiderCount}, minimum is 4.`,
      [], [],
      'Too few Outsiders',
      'A standard BotC script requires at least 4 Outsider characters to support player-count range flexibility. With fewer than 4, the Storyteller lacks the setup options needed at certain player counts and the script is incomplete.'
    ));
  if (scriptContext.minionCount < 4)
    findings.push(makeScriptFinding('E01', 'hard_error',
      `Too few Minions: script has ${scriptContext.minionCount}, minimum is 4.`,
      [], [],
      'Too few Minions',
      'A standard BotC script requires at least 4 Minion characters to support the player-count range from 5 to 15+ players. With fewer than 4, high-player-count games have no Minion options to draw from and the script is incomplete.'
    ));
  if (scriptContext.demonCount < 1)
    findings.push(makeScriptFinding('E01', 'hard_error', 'No Demon on this script.',
      [], [],
      'No Demon on script',
      'A BotC script requires at least one Demon. Without a Demon the game has no evil win condition and cannot be played as designed.'
    ));
  return findings;
}

export function ruleE03(roster, scriptContext, charById) {
  if (scriptContext.hasOutsiderObfuscation) return null;
  return makeScriptFinding('E03', 'hard_error',
    'No Outsider-count modifier or hider. Good players can count Outsiders with certainty from day 1.',
    [], [],
    'No Outsider-count modifier or hider',
    'Without a role that modifies or obscures the Outsider count — Baron adds Outsiders, Recluse and Spy misregister — good players can count the Outsiders visible on the script and know from day 1 exactly how many are in play. This removes a key layer of deductive uncertainty and makes it easier to identify players who are \'wrong\' for the expected count. A modifier or hider gives the evil team the ambiguity it needs to bluff Outsider claims.'
  );
}

export function ruleE04(roster, scriptContext, charById) {
  if (scriptContext.hasSentinel) return [];
  const selectedIds = new Set(roster);
  const findings = [];
  for (const j of jinxes) {
    if (j.type !== 'hate') continue;
    if (!j.characters.every(id => selectedIds.has(id))) continue;
    findings.push({
      rule: 'E04', message: 'Hate-jinxed pair on script without Sentinel Fabled.',
      characters: [...j.characters],
      type: 'pair', rule_id: 'E04', severity: 'hard_error',
      kind: 'verdict', provenance: null,
      notice_text: 'Hate-jinxed pair without Sentinel Fabled',
      explainer_text: 'A hate jinx is a character combination that is rules-incompatible or creates a broken game state when both are in play. Unlike standard jinxes — which have an additional rule to resolve the interaction — hate jinxes have no resolution: the characters simply cannot coexist. Sentinel Fabled allows the Storyteller to remove characters from the script mid-game, which is the canonical mitigation for a hate jinx. Without Sentinel, this pair makes the script structurally unsound and it cannot be safely run as-is.',
      affected_characters: [...j.characters], missing_mitigations: ['sentinel'],
    });
  }
  return findings;
}

export function ruleE05(roster, scriptContext, charById) {
  if (scriptContext.strongEvilRoles.length < 2 || scriptContext.hasSpiritOfIvory) return null;
  return makeScriptFinding('E05', 'hard_error',
    'Two or more strong extra-evil sources without Spirit of Ivory. Player counts will be unpredictable.',
    scriptContext.strongEvilRoles, [],
    'Multiple strong extra-evil sources without Spirit of Ivory',
    'Strong extra-evil sources are roles that add extra evil players beyond the standard Demon and Minion count. When two or more are on the same script, the number of evil players in any given game becomes unpredictable, making player-count-based reasoning unreliable for good. Spirit of Ivory constrains the extra-evil count to at most one, providing a ceiling. Without it, the script\'s evil team size is effectively undefined and the good team cannot reason about how many evil players they are looking for.'
  );
}

export function ruleE06(roster, scriptContext, charById) {
  if (scriptContext.minionCount !== 1) return null;
  const minionId = roster.find(id => charById.get(id)?.team === 'minion');
  return makeCharFinding('E06', 'hard_error',
    'Only one Minion on this script — at single-Minion player counts it is always in play, telegraphing your Minion choice.',
    minionId ? [minionId] : [], [],
    'Only one Minion on script',
    'At single-Minion player counts (around 5–7 players), the game setup always includes exactly one Minion. If the script has only one Minion character, that character is always in play at those player counts — the Storyteller has no choice and the Minion\'s identity is telegraphed before the game begins. Scripts typically include at least two or three Minions to preserve setup variance and prevent the Minion role from being a known quantity.'
  );
}

export function ruleE07(roster, scriptContext, charById) {
  if (!scriptContext.hasSpiritOfIvory || scriptContext.hasExtraEvil) return null;
  return makeScriptFinding('E07', 'hard_error',
    'Spirit of Ivory is on the script but no extra-evil source exists. The Fabled adds a restriction with nothing to restrict.',
    [], [],
    'Spirit of Ivory with no extra-evil source',
    'Spirit of Ivory is a Fabled that prevents more than one extra-evil player from being in play. Without any roles that would actually add extra-evil players — Baron, Godfather, Bounty Hunter, and similar — Spirit of Ivory adds a restriction to a situation that cannot occur. The Fabled has no functional effect on this script. Either add an extra-evil source to give Ivory something to constrain, or remove Ivory from the script.'
  );
}

export function ruleE08(roster, scriptContext, charById) {
  const selectedIds = new Set(roster);
  const findings = [];
  for (const id of roster) {
    const char = charById.get(id);
    if (!hasV2Tagging(char)) continue;
    for (const conf of char.confirmations ?? []) {
      if (conf.type !== 'hard') continue;
      const procs = conf.proc_confounders ?? [];
      if (procs.length === 0) continue;
      const status = counterpartStatus(procs, selectedIds);
      if (!status.satisfied) {
        const sev = conf.severity ?? 'hard_error';
        const ruleId = sev === 'soft_warning' ? 'W14' : 'E08';
        findings.push(makeCharFinding(ruleId, sev,
          `${id} is a hard-confirmation role with no proc-confounder on this script.`,
          [id], procs.map(p => p.id),
          `${id} — hard-confirmation role with no proc-confounder`,
          'This character has a hard-confirmation ability — a mechanic that allows a player to definitively prove their identity to the good team. Without any proc-confounder on the script (Drunk, Boffin, or a role that makes the confirmation process unreliable), a Demon cannot bluff this character: if they claim it, they\'ll be caught when the confirmation fails to fire correctly. Hard-confirmation roles without confounders create known-safe claims that significantly anchor the good team\'s deduction.'
        ));
      } else if (status.partial) {
        findings.push(makeCharFinding('W14', 'soft_warning',
          `${id} has only partial proc-confounder coverage on this script.`,
          [id], procs.filter(p => !selectedIds.has(p.id)).map(p => p.id),
          `${id} — partial proc-confounder coverage`,
          'This character has a hard-confirmation ability, and at least one proc-confounder is on the script — but some of its confounders are absent. Partial coverage means the Demon can bluff this character with some risk: the confounder explains why confirmation might not fire, but the explanation is less airtight than full coverage. This is a soft warning rather than a hard error. Partial coverage is often intentional and can produce interesting bluffing dynamics; confirm the Demon\'s bluff space is sufficient for your design goals.'
        ));
      }
    }
  }
  return findings;
}

export function ruleE11(roster, scriptContext, charById) {
  const selectedIds = new Set(roster);
  const findings = [];
  for (const id of roster) {
    const char = charById.get(id);
    if (!hasV2Tagging(char)) continue;
    for (const conf of char.confirmations ?? []) {
      if (conf.type !== 'load_bearing_soft') continue;
      const claims = conf.claim_confounders ?? [];
      if (claims.length === 0) continue;
      const status = counterpartStatus(claims, selectedIds);
      if (!status.satisfied) {
        findings.push(makeCharFinding('E11', 'hard_error',
          `${id} is a load-bearing confirmation role with no claim-confounder on this script.`,
          [id], claims.map(c => c.id),
          `${id} — load-bearing confirmation with no claim-confounder`,
          'This character uses a load-bearing soft confirmation — a claim about their identity that the good team relies on to make execution decisions. Without a claim-confounder on the script (a role that would make the same claim plausible for a Demon), the claim cannot be contested: any player claiming this character is almost certainly telling the truth. This removes bluff space for the Demon impersonating this role and gives the good team a reliable anchor that is very difficult to challenge.'
        ));
      }
    }
  }
  return findings;
}

export function ruleW01(roster, scriptContext, charById) {
  const selectedIds = new Set(roster);
  const needers = [];
  for (const id of roster) {
    const char = charById.get(id);
    if (!char) continue;
    if (hasV2Tagging(char)) {
      for (const conf of char.confirmations ?? []) {
        if (conf.type !== 'info') continue;
        const cover = conf.info_bluff_cover ?? [];
        if (cover.length > 0 && !cover.some(cc => selectedIds.has(cc.id))) needers.push(id);
      }
    } else if (char.lint?.grimpeekerNeeded) {
      if (!roster.some(rid => charById.get(rid)?.lint?.grimpeeker)) needers.push(id);
    }
  }
  if (needers.length === 0) return null;
  const unique = [...new Set(needers)];
  return makeCharFinding('W01', 'soft_warning',
    `${unique.join(', ')} produce info that is hard to bluff without a Grimoire-peeker (Spy or Widow).`,
    unique, [],
    'Info-heavy roles without a Grimoire-peeker',
    'Some Townsfolk produce night information that a Demon cannot plausibly fake without knowing the exact Grimoire contents — they give specifics that Minions can\'t fabricate unless they see what the Storyteller sees. Spy and Widow are the canonical Grimoire-peekers: Minions who see the full Grimoire each night, enabling the Demon to back the right bluffs. Without a peeker, the Demon\'s options for bluffing these characters narrow: a wrong claim can be caught when the information doesn\'t match what was expected. Many scripts run without a peeker by design, but acknowledge the bluff-space constraint.'
  );
}


export function ruleW06(roster, scriptContext, charById) {
  if (scriptContext.townsfolkCount <= 7 || scriptContext.droizonDensity >= 2) return null;
  return makeScriptFinding('W06', 'soft_warning',
    `Script has ${scriptContext.townsfolkCount} Townsfolk but only ${scriptContext.droizonDensity} misinfo source(s). With little interference, the good team may dominate through reliable information.`,
    [], [],
    'Information-rich Townsfolk list with low droison',
    'A large Townsfolk pool with few droison sources means that on most nights, the good team receives accurate information from most of its members. With enough players cross-referencing reliable night information, good can rapidly triangulate evil players and narrow the Demon\'s hiding space. Scripts with many Townsfolk typically compensate with additional misinfo to maintain uncertainty. If the information-heavy design is intentional, ensure the evil team has enough social tools — strong Minions, misregistration, or bluff space — to compete.'
  );
}

export function ruleW07(roster, scriptContext, charById) {
  if (scriptContext.droizonDensity <= 4) return null;
  return makeScriptFinding('W07', 'soft_warning',
    'High misinfo density — more than 4 droison sources may frustrate players who cannot trust any night information.',
    [], [],
    'Very high droison density — more than 4 misinfo sources',
    'With more than four droison sources on the script, a significant portion of the good team\'s night information is false on most nights. While some misinfo is healthy, too much can frustrate players who enjoy the deduction phase — when no individual piece of night information can be trusted, coordinating the good team becomes much harder and the game can feel like guesswork. Very high droison density tips the balance heavily toward evil. Confirm the uncertainty level is proportionate to the confirmation and detection tools available.'
  );
}


export function ruleW08(roster, scriptContext, charById) {
  if (scriptContext.demonCount < 2) return null;
  if (roster.some(id => charById.get(id)?.lint?.deadCanBeEvil === true)) return null;
  return makeScriptFinding('W08', 'soft_warning',
    'Multiple Demons on script with no dead-can-be-evil source. "Died at night means good" becomes reliable, which undercuts the multi-Demon design.',
    [], [],
    'Multi-Demon script with no dead-can-be-evil source',
    'On a multi-Demon script, the good team should not be able to assume that a player who died at night is automatically good. A dead-can-be-evil mechanism — an Imp star-pass, a Scarlet Woman takeover, kept-alive Minions, or similar — keeps night deaths ambiguous so the good team cannot fully trust the dead. Without any such source, every night death confirms a good player for free, which is unusually generous to good and defeats much of the point of running more than one Demon. Add a role that makes at least some deaths untrustworthy, or confirm the clean-death dynamic is intended.'
  );
}

export function ruleW09(roster, scriptContext, charById) {
  const demons = roster.filter(id => charById.get(id)?.team === 'demon');
  const loud   = demons.filter(id => charById.get(id)?.lint?.loudDemon === true);
  const quiet  = demons.filter(id => charById.get(id)?.lint?.loudDemon !== true);
  if (loud.length === 0 || quiet.length === 0) return null;
  return makeCharFinding('W09', 'soft_warning',
    'Loud and quiet Demons are mixed on this script — inconsistent Demon-reveal expectations.',
    demons, [],
    'Mixed loud and quiet Demons on script',
    'Loud Demons — Leviathan, Riot, and others — operate publicly: their presence is known or their actions happen in the day phase. Quiet Demons kill secretly at night. When both types appear on the same script, the good team has inconsistent expectations about Demon behaviour: a quiet kill one night doesn\'t rule out a loud Demon, and public knowledge doesn\'t help identify a quiet one. This can create incoherent deduction dynamics. The mix may be intentional — confirm it\'s by design.'
  );
}

export function ruleW10(roster, scriptContext, charById) {
  const findings = [];
  for (const id of roster) {
    if (charById.get(id)?.lint?.vortoxFlag === true)
      findings.push(makeCharFinding('W10', 'soft_warning',
        `${id} significantly warps script design and requires experienced storytelling.`,
        [id], [],
        `${id} — requires experienced Storytelling`,
        'This character significantly warps standard script design and requires a Storyteller comfortable with its mechanical complexity and its effects on the game\'s information structure. Characters with this flag are rarely suitable for beginner games and may require careful setup and explanation. This is a design note, not a blocker: experienced Storytellers handle these roles successfully. Be intentional about the skill level of your expected audience.'
      ));
  }
  return findings;
}

export function ruleW11(roster, scriptContext, charById) {
  if (!roster.includes('mathematician')) return null;
  const misinfoChars = roster.filter(id => charById.get(id)?.lint?.misinfo === true);
  if (misinfoChars.length < 3) return null;
  const shapes = [...new Set(misinfoChars.map(id => charById.get(id)?.lint?.misinfoShape).filter(Boolean))];
  if (shapes.length < 2) return null;
  return makeCharFinding('W11', 'soft_warning',
    `Mathematician is on a script with ${misinfoChars.length} misinfo sources of mixed shapes (${shapes.join(', ')}).`,
    ['mathematician', ...misinfoChars], [],
    'Mathematician with mixed-shape misinfo sources',
    'The Mathematician learns how many players are receiving wrong information each night, but the count combines different misinfo shapes — Poisoner false-info, Widow-style grimoire-peek poisoning, and Drunk-style drunkenness all increment the same counter. When three or more misinfo sources with different shapes are on the same script, the Mathematician\'s count is hard to parse: players can\'t easily tell which source caused which effect. This dilutes the Mathematician\'s diagnostic value and may produce confusing information for players trying to use it as a deduction tool.'
  );
}

export function ruleW13(roster, scriptContext, charById) {
  const misregChars  = roster.filter(id => charById.get(id)?.lint?.misregistration === true);
  const nonconfChars = roster.filter(id => charById.get(id)?.lint?.nonconformistInfo === true);
  if (misregChars.length === 0 || nonconfChars.length === 0) return null;
  const chars = [...new Set([...misregChars, ...nonconfChars])];
  return makeCharFinding('W13', 'soft_warning',
    'Misregistering and nonconformist-info roles on the same script. The Storyteller will need to navigate complex registration edge cases.',
    chars, [],
    'Misregistering and nonconformist-info roles on the same script',
    'Misregistering roles produce information that doesn\'t match what players would normally expect. This takes different forms: Spy and Recluse through alignment misregistration (registering as the opposite alignment to detectors), Zombuul through death-state misregistration (appearing to die while actually surviving), and Lycanthrope through kill-source misregistration (a Townsfolk generating a night kill that players attribute to the Demon). Nonconformist-info roles — Artist, Savant, Amnesiac, Wizard — give night information in ways that don\'t follow standard patterns. When both types appear together, the Storyteller must navigate complex edge cases where the misregistered information interacts with information already playing by unusual rules. The combination is legal and some designers create these interactions intentionally, but Storytelling complexity increases significantly.'
  );
}

export function ruleW15(roster, scriptContext, charById) {
  if (!roster.includes('boffin')) return null;
  const confirmableHardRoles = roster.filter(id => {
    const char = charById.get(id);
    return hasV2Tagging(char) && (char.confirmations ?? []).some(conf => conf.type === 'hard');
  });
  if (confirmableHardRoles.length < 3) return null;
  return makeCharFinding('W15', 'soft_warning',
    `Boffin is on script with ${confirmableHardRoles.length} hard-confirmation Townsfolk. Every confirmable good claim is suspect.`,
    ['boffin', ...confirmableHardRoles], [],
    `Boffin with ${confirmableHardRoles.length} confirmable Townsfolk`,
    'Boffin gives the Demon a Townsfolk ability, meaning the Demon can claim to be the character whose ability Boffin granted. When three or more hard-confirmation Townsfolk are on the same script, the Demon can claim any of them — and so can the Boffin-empowered Demon. Every confirmable good claim becomes suspect because the Demon might genuinely have that ability through Boffin. The good team loses the ability to trust hard confirmations, which significantly complicates deduction. This is a strong design choice — ensure players understand the dynamic before the game begins.'
  );
}

export function ruleW16(roster, scriptContext, charById) {
  if (!roster.includes('mayor')) return null;
  const mayor = charById.get('mayor');
  if (!hasV2Tagging(mayor)) return null;
  const selectedIds = new Set(roster);
  const claimConf = (mayor.confirmations ?? []).find(c => c.mode === 'claim');
  if ((claimConf?.claim_confounders ?? []).some(c => selectedIds.has(c.id))) return null;
  if (!selectedIds.has('lunatic') && !selectedIds.has('magician')) return null;
  return makeCharFinding('W16', 'soft_warning',
    "Mayor is on script with bounce-confounders (Lunatic/Magician) but no claim-confounders. Mayor's survival is supported but the claim itself is not bluffable.",
    ['mayor'], [],
    'Mayor has bounce support but no claim cover',
    "Mayor's survival mechanic — bouncing executions onto others — can be affected by Lunatic or Magician, which create noise around how bounces work. However, Mayor's claim itself is a load-bearing public declaration that the good team uses to manage executions. Without claim-confounders (characters that would make the Mayor claim plausible for a Demon to fake), Mayor's survival is mechanically supported but the claim cannot be contested. This reduces deduction complexity around Mayor and may make the good team's coordination easier than intended."
  );
}

export function ruleW17(roster, scriptContext, charById) {
  const MULTI_KILL = new Set(['po', 'shabaloth', 'al-hadikhia', 'riot', 'leviathan', 'legion', 'lil-monsta']);
  const NIGHT_PROTECTION = new Set(['soldier', 'monk', 'innkeeper', 'sailor', 'tea-lady', 'fool', 'lleech']);
  const quietOneKillDemons = roster.filter(id => {
    const char = charById.get(id);
    return char?.team === 'demon' && !char.lint?.loudDemon && !MULTI_KILL.has(id);
  });
  if (quietOneKillDemons.length === 0) return null;
  if (roster.some(id => NIGHT_PROTECTION.has(id))) return null;
  return makeCharFinding('W17', 'soft_warning',
    `Script has a quiet single-kill Demon but no night-protection role (Soldier, Monk, Innkeeper, Sailor, Tea Lady, Fool, Lleech). The Demon's kill pattern will read too cleanly.`,
    quietOneKillDemons, [],
    'Quiet single-kill Demon with no night-protection roles',
    'A quiet, single-kill Demon kills exactly one player per night, creating a predictable death rhythm that good players can use to track the Demon\'s activity. Night-protection roles — Soldier, Monk, Innkeeper, Sailor, Tea Lady, Fool, Lleech — introduce uncertainty: when protection is in play, a missing kill might mean protection rather than Demon absence. Without any protection roles, the Demon\'s kill pattern reads cleanly and the Demon has less cover for deviating from expected behaviour. Strongly consider adding at least one night-protection role.'
  );
}

export function ruleW18(roster, scriptContext, charById) {
  if (scriptContext.jinxCount <= 5) return null;
  return makeScriptFinding('W18', 'soft_warning',
    `Script has ${scriptContext.jinxCount} jinxed pairs. Players may struggle to internalise this many rules during play.`,
    [], [],
    `${scriptContext.jinxCount} jinxed pairs on script`,
    'Jinxes add additional rules that modify how two characters interact when both are on the same script. A script with many jinxed pairs creates significant cognitive overhead: players need to know these extra rules before and during play, and Storytellers must track multiple simultaneous interaction exceptions. Six or more jinxed pairs is a meaningful threshold — experienced groups handle this comfortably, but newer groups may find the rule count overwhelming. Consider whether the jinx density is intentional or whether the roster could be simplified.'
  );
}

const CERTAINTY_UNDERMINERS = new Set(['drunk', 'marionette', 'puzzlemaster', 'lleech', 'boffin']);

export function ruleW20(roster, scriptContext, charById) {
  if (roster.some(id => CERTAINTY_UNDERMINERS.has(id))) return null;
  if (scriptContext.confirmationCluster.size < 2) return null;
  return makeScriptFinding('W20', 'informational',
    `Script has ${scriptContext.confirmationCluster.size} strong informational roles with nothing to undermine player certainty.`,
    [], [],
    'Strong informational roles with nothing to undermine certainty',
    'When players can trust that they are who they think they are, strong informational roles become very powerful — every confirmed claim can be taken at face value.\n\nDrunk — appears to be a Townsfolk but receives false night information; the Drunk player does not know they are Drunk.\nMarionette — appears to be a good role but is secretly a Minion; the Marionette does not know their true alignment.\nPuzzlemaster — one player is drunk without knowing it, creating the same self-doubt in an unknown good player.\nLleech — poisons its chosen host from setup; the host does not know they are poisoned, so any ability they use may give false results.\nBoffin — gives the Demon a Townsfolk ability at setup; the Demon can be granted a hard-confirmation ability, making their claims indistinguishable from a genuine confirmation.\n\nWithout one of these, players who receive strong night information can claim it with full confidence. This is a valid design choice, but worth confirming — a script with a dense confirmation cluster and no certainty-undermining role gives good a very reliable information foundation.'
  );
}

export function ruleW21(roster, scriptContext, charById) {
  if (!roster.includes('slayer') || !roster.includes('lleech')) return null;
  return makeCharFinding('W21', 'soft_warning',
    'Slayer and Lleech are both on script — if Slayer slays the Lleech host, the host dies. Confirm this interaction is intentional.',
    ['slayer', 'lleech'], [],
    'Slayer and Lleech on script — confirm interaction is intentional',
    'Slayer can kill a player they nominate by claiming they are the Demon. If the Slayer slays the Lleech\'s host, the host dies — and if the host dies, the Lleech dies with them. This means a Slayer who correctly identifies the Lleech\'s host can use a one-shot ability to kill both the host and the Demon in a single action. This interaction is not broken, but it is powerful. If you did not intend the Slayer to have this capability on this script, consider a different pairing.'
  );
}

export function ruleW22(roster, scriptContext, charById) {
  if (!roster.includes('grandmother')) return null;
  const loudDemonIds = roster.filter(id => charById.get(id)?.lint?.loudDemon === true);
  if (loudDemonIds.length === 0) return null;
  return makeCharFinding('W22', 'soft_warning',
    'Grandmother and a loud Demon are both on script — the Grandmother/Leviathan or Grandmother/Riot jinx creates a free evil-win condition if the Grandchild is executed.',
    ['grandmother', ...loudDemonIds], [],
    'Grandmother and loud Demon — potential free evil-win condition',
    'Grandmother knows the identity of a specific good player (their Grandchild) and will die if that player is executed. Leviathan and Riot have jinxes with Grandmother that create a particularly dangerous condition: if the Grandchild is executed, the Grandmother dies — and if certain Leviathan or Riot mechanics trigger on the same day, evil can win immediately. This combination can produce a free evil-win condition if the Storyteller is not careful. Understand the jinx mechanics thoroughly before running a script with this pairing.'
  );
}

export function ruleW23(roster, scriptContext, charById) {
  if (!scriptContext.hasAtheist) return null;
  return makeScriptFinding('W23', 'soft_warning',
    "Atheist rewrites the script's win condition — most lint rules become advisory on Atheist scripts.",
    [], [],
    'Atheist on script — most lint rules become advisory',
    "The Atheist's ability lets the good team win by executing the Storyteller — a completely different win condition that bypasses all normal Demon-identification logic. On an Atheist script, the Storyteller explicitly breaks the rules from setup onward, placing no Demon and showing any token to any player at any time. This means nearly all of the analyser's structural rules become advisory rather than binding on Atheist scripts: checks for Demon presence, misinfo, confirmation clusters, and so on apply to non-Atheist configurations. Treat other findings on this script as suggestions when Atheist is the intended win path."
  );
}

export function ruleJinxPairs(roster, charById) {
  const selectedIds = new Set(roster.map(id => normaliseCharId(id)));
  const findings = [];
  for (const j of jinxes) {
    if (j.characters.length !== 2) continue;
    const [a, b] = j.characters.map(normaliseCharId);
    if (selectedIds.has(a) && selectedIds.has(b)) {
      findings.push({
        rule: 'N01', message: j.djinnRule, characters: [...j.characters],
        type: 'pair', rule_id: 'N01', severity: 'informational',
        kind: 'verdict', provenance: null,
        notice_text: j.djinnRule,
        explainer_text: 'Jinx rules are additional mechanics that apply when both characters are on the same script. The Djinn (or Storyteller) announces these rules to all players before the game begins so everyone is aware of the interaction. Refer to the rule text above for the specific mechanic.',
        affected_characters: [...j.characters], missing_mitigations: [],
      });
    }
  }
  return findings;
}

function evaluateTrigger(trigger, selectedIds) {
  switch (trigger.type) {
    case 'any_on_script':
      return trigger.characters.some(id => selectedIds.has(id));
    case 'all_on_script':
      return trigger.characters.every(id => selectedIds.has(id));
    case 'cross_group': {
      const aPresent = trigger.group_a.some(id => selectedIds.has(id));
      const bPresent = trigger.group_b.some(id => selectedIds.has(id));
      return aPresent && bPresent;
    }
    default:
      return false;
  }
}

export function ruleOpenQuestions(roster, charById, scriptContext) {
  const selectedIds = new Set(roster);
  const fired = new Set();
  const findings = [];
  for (const id of roster) {
    const char = charById.get(id);
    for (const oqNum of char?.open_questions ?? []) {
      if (fired.has(oqNum)) continue;
      const oq = openQuestions.find(q => q.id === oqNum && !q.resolved);
      if (!oq) continue;
      if (!evaluateTrigger(oq.trigger, selectedIds)) continue;
      fired.add(oqNum);
      findings.push({
        rule: `OQ-${oq.id}`, message: oq.text, characters: [],
        type: 'character', rule_id: `OQ-${oq.id}`, severity: 'informational',
        kind: 'verdict', provenance: null,
        notice_text: `Open Question ${oq.id}`, explainer_text: oq.text,
        affected_characters: [], missing_mitigations: [],
      });
    }
  }
  return findings;
}

// ─── Pass 2b: Advisory rules (kind: 'advisory') ──────────────────────────────
// The qualitative layer. These emit observations, never verdicts, and are routed to the
// `advisories` stream. First one (A01) is a deliberately cheap, non-relational readout that
// proves the advisory pipeline end to end; the relational corrective-Fabled advisory is C4.

export function ruleA01(roster, scriptContext, charById) {
  const n = scriptContext.droizonDensity;
  return makeAdvisory('A01',
    `Droison sources: ${n}. Most published scripts run 2 to 4.`,
    {
      provenance: 'community',
      value: n,
      noticeText: 'Droison sources',
      explainerText: 'Droison (drunk or poison) sources are what stop the good team trusting every piece of night information. Most published scripts carry two to four; fewer can let good solve the script through reliable deduction, more can tip play toward guesswork. This is a rule of thumb, not a target — where your script sits is your call, and the table is the only real judge.',
    });
}

// ── Corrective-Fabled advisories (its own logical module; Section 24.4) ───────
// Medway (Behind the Curtain #7) names Storytellers omitting corrective Fabled as the biggest
// real balance failure in custom games — bigger than any unbalanced combo. Relational: each rule
// fires when the script STRUCTURE demands a Fabled and it is absent. Advisory only — it observes
// and hands judgement back, never gates. Physically in-file for now; a split to
// advisories/correctiveFabled.js is an easy follow-up if this table grows (would pair with
// extracting the finding factories into a shared module to avoid a circular import).
// Duchess is deliberately omitted: its "structure demands it" predicate is unresolved (OQ 24.F).
const CORRECTIVE_FABLED = [
  {
    rule_id: 'AF-sentinel',
    demanded: (ctx) => !ctx.hasOutsiderObfuscation,
    absent:   (ctx) => !ctx.hasSentinel,
    provenance: 'official',
    message: 'The Outsider count on this script is fixed — nothing hides or modifies it, so good can deduce it exactly. A Sentinel would make it uncertain again.',
    notice: 'Consider a Sentinel',
    explainer: 'When the Outsider count is knowable, bluffing as an Outsider becomes risky and roles like the Drunk and Lunatic get easier to solve. The Sentinel Fabled makes the count uncertain (there might be one more or one fewer Outsider than expected), which is the canonical Fabled fix. The game\'s designer specifically flags a known Outsider count with no Sentinel as "crushing for the evil team". This is a suggestion, not a requirement — a Fabled is one way to answer the fixed-count concern; changing the roster is another.',
  },
  {
    rule_id: 'AF-fibbin',
    demanded: (ctx) => ctx.droizonDensity === 0,
    absent:   (ctx, roster) => !roster.includes('fibbin'),
    provenance: 'official',
    message: 'No source of drunkenness or poisoning on this script. A Fibbin would give the good team a reason to doubt its night information.',
    notice: 'Consider a Fibbin',
    explainer: 'With no droison source, every Townsfolk receives accurate information every night and good can solve the script through deduction alone. The Fibbin Fabled supplies a once-per-game piece of false information, restoring a little uncertainty. The game\'s designer names a script with no possibility of drunkenness or poisoning and no Fibbin as "very unfair to the evil players". Adding a droison character is the alternative; the Fabled is the lighter-touch fix.',
  },
  {
    rule_id: 'AF-spirit-of-ivory',
    demanded: (ctx) => ctx.hasExtraEvil,
    absent:   (ctx) => !ctx.hasSpiritOfIvory,
    provenance: 'official',
    message: 'This script has a source of extra evil players. A Spirit of Ivory caps the extra evils at one — though opinions differ on whether it is the right tool.',
    notice: 'Consider a Spirit of Ivory (with a caveat)',
    explainer: 'When a script can create extra evil players, the good team can find itself outnumbered beyond the intended balance. The game\'s designer names the Spirit of Ivory as a corrective: it guarantees no more than one extra evil player. The counter-view, held by several community designers, is that the Spirit of Ivory is widely misused — it does not fix a script that can produce +2 evils, it only locks one of the +Evil abilities out of that game. Both positions are worth weighing; this is genuinely a design judgement, not a fix to apply automatically.',
  },
];

export function advisoriesCorrectiveFabled(roster, scriptContext, charById) {
  const out = [];
  for (const rule of CORRECTIVE_FABLED) {
    if (rule.demanded(scriptContext, roster) && rule.absent(scriptContext, roster)) {
      out.push(makeAdvisory(rule.rule_id, rule.message, {
        provenance: rule.provenance,
        noticeText: rule.notice,
        explainerText: rule.explainer,
      }));
    }
  }
  return out;
}

function addFinding(errors, warnings, notices, finding, atheist_mode) {
  // Verdict-only gate: advisories/reflections must never enter the error/warning/notice
  // buckets (they route to their own streams). This guard enforces the invariant structurally.
  if (finding.kind && finding.kind !== 'verdict') return;
  const effective = atheist_mode
    ? finding.severity === 'hard_error'   ? 'soft_warning'
    : finding.severity === 'soft_warning' ? 'informational'
    : finding.severity
    : finding.severity;
  const f = { ...finding, severity: effective };
  if (effective === 'hard_error')        errors.push(f);
  else if (effective === 'soft_warning') warnings.push(f);
  else                                   notices.push(f);
}

export function runRules(roster, charById, scriptContext, options = {}) {
  const { atheist_mode: explicitMode } = options;
  const atheist_mode = explicitMode !== undefined ? explicitMode : scriptContext.hasAtheist;
  const errors    = [];
  const warnings  = [];
  const notices   = [];
  const advisories = [];

  let f;
  for (const fi of ruleE01(roster, scriptContext, charById)) addFinding(errors, warnings, notices, fi, atheist_mode);
  if (f = ruleE02(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleE03(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  for (const fi of ruleE04(roster, scriptContext, charById)) addFinding(errors, warnings, notices, fi, atheist_mode);
  if (f = ruleE05(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleE06(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleE07(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  for (const fi of ruleE08(roster, scriptContext, charById)) addFinding(errors, warnings, notices, fi, atheist_mode);
  for (const fi of ruleE11(roster, scriptContext, charById)) addFinding(errors, warnings, notices, fi, atheist_mode);
  if (f = ruleW01(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW06(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW07(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW08(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW09(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  for (const fi of ruleW10(roster, scriptContext, charById)) addFinding(errors, warnings, notices, fi, atheist_mode);
  if (f = ruleW11(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW12(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW13(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  // W14 is emitted inside ruleE08
  if (f = ruleW15(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW16(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW17(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW18(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  // TODO: W19 — Traveller list missing or incomplete (Section 21 SW #13). Out of scope: Travellers are game-time, not script-tool-time.
  if (f = ruleW20(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW21(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW22(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleW23(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  // TODO: W24 — Vortox without Vortox-detector (Section 21 SW #19). Requires: v2.1 vortox_detector field
  // TODO: W25 — 2+ built_in_confound roles (Section 21 SW #20). Requires: v2.1 built_in_confound field
  // TODO: W26 — ST-crafted info roles (2+ high load) (Section 21 SW #21). Requires: v2.1 st_crafted_info field
  // TODO: W27 — 2+ alignment_swap roles (Section 21 SW #22). Requires: v2.1 alignment_swap field
  // TODO: W28 — delayed_info + kill_attribution_confound (Section 21 SW #23). Requires: v2.1 delayed_info field
  // TODO: W29 — good-side droison + built_in_confound stacking (Section 21 SW #24). Requires: v2.1 built_in_confound field
  // TODO: W30 — 2+ setup-modifying roles (Section 21 SW #25). Requires: v2.1 setup_modifying_role field
  // TODO: W31 — jinx_burden >= 3 per role (Section 21 SW #27). Requires: v2.1 jinx_burden field
  // TODO: W32 — mid-game + setup-time setup-modifying role pair (Section 21 SW #28). Requires: Engineer + setup-modifier IDs
  if (f = ruleN41(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  // TODO: N44 — Aggregate ST cognitive-load score (Section 21 #44). Requires: lint.stCreativeAuthority, jinx_burden fields
  // TODO: N45 — Leviathan/Riot procedural-patch coverage (Section 21 #45). Requires: v2.1 signature_breadth field
  // TODO: N46 — post_death_voting_power roles (Section 21 #46). Requires: v2.1 post_death_voting_power field
  // TODO: N47 — demon_kill_as_info roles (Section 21 #47). Requires: v2.1 demon_kill_as_info field
  // TODO: N48 — demon_knows_role_at_setup roles (Section 21 #48). Requires: v2.1 demon_knows_role_at_setup field
  // TODO: N49 — structural-pair roles (Section 21 #49). Requires: v2.1 structural_pair field
  // TODO: N50 — Recluse + alignment-detection density (Section 21 #50). Requires: v2.1 alignment_detection field
  // TODO: N51 — is_passive_handicap_outsider cluster (Section 21 #51). Requires: v2.1 is_passive_handicap_outsider field
  // TODO: N52 — is_setup_deception_role cluster (Section 21 #52). Requires: v2.1 is_setup_deception_role field
  // TODO: N53 — vote_restriction_role cluster (Section 21 #53). Requires: v2.1 vote_restriction_role field
  // TODO: N54 — team_aware_wincon_mechanic cluster (Section 21 #54). Requires: v2.1 team_aware_wincon_mechanic field
  // TODO: N55 — Barber/Hatter + start-knowing or once-per-game roles (Section 21 #55). Requires: v2.1 re_triggers fields
  // TODO: N56 — vortox_resistant roles (Section 21 #56). Requires: v2.1 vortox_resistant field
  // TODO: N57 — Barber + character-flux density (Section 21 #57). Requires: v2.1 character_flux field
  // TODO: N58 — is_active_ability_outsider cluster (Section 21 #58). Requires: v2.1 is_active_ability_outsider field
  // TODO: N59 — wincon_rewriting_role cluster (Section 21 #59). Requires: v2.1 wincon_rewriting_role field
  // TODO: N60 — Heretic + droison-source deliberate-disable (Section 21 #60). Requires: droizonDensity threshold check
  // TODO: N61 — Hermit ST-load multiplier (Section 21 #61). Requires: Hermit ID in roster + outsiderCount threshold
  // TODO: N62 — setup_disable_via_grimoire_peek coverage (Section 21 #62). Requires: v2.1 sub_type on jinxes[]
  // TODO: N63 — triggers_on_death_grants_st_ability roles (Section 21 #63). Requires: v2.1 triggers_on_death_grants_storyteller_ability field
  // TODO: N64 — proc_is_st_discretionary cluster (Section 21 #64). Requires: v2.1 proc_is_st_discretionary field
  // TODO: N65 — vote-restriction inverse-stack Butler+Zealot (Section 21 #65). Requires: Butler and Zealot IDs in roster
  if (f = ruleN66(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleN67(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleN68(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  // TODO: N69 — info_token_role density cap (Section 21 #69). Requires: v2.1 info_token_role field
  // TODO: N70 — night_info_diminishing_returns cluster (Section 21 #70). Requires: v2.1 night_info_diminishing_returns field
  // TODO: N71 — bluff_space narrowing from hidden demons (Section 21 #71). Requires: v2.1 hidden_demon field
  // TODO: N72 — bluff_space_amplifier role cluster (Section 21 #72). Requires: v2.1 bluff_space_amplifier field
  // TODO: N73 — bluff_space_reducer role cluster (Section 21 #73). Requires: v2.1 bluff_space_reducer field
  // TODO: N74 — is_bluff_target role cluster (Section 21 #74). Requires: v2.1 is_bluff_target field
  // TODO: N75 — removes_bluff_space role cluster (Section 21 #75). Requires: v2.1 removes_bluff_space field
  // TODO: N76 — Puzzlemaster + info-role synergy (Section 21 #76). Requires: v2.1 puzzlemaster_synergy field
  // TODO: N77 — Cannibal + execution-survival cluster interaction (Section 21 #77). Requires: Cannibal ID in roster
  // TODO: N78 — info_corruption_role cluster (Section 21 #78). Requires: v2.1 info_corruption_role field
  // TODO: N79 — info_suppression_role cluster (Section 21 #79). Requires: v2.1 info_suppression_role field
  // TODO: N80 — bluff_space_total score (Section 21 #80). Requires: v2.1 bluff_space_total scoring
  // TODO: N81 — demon_hide_role cluster (Section 21 #81). Requires: v2.1 demon_hide_role field
  // TODO: N82 — hidden_identity_count threshold (Section 21 #82). Requires: v2.1 hidden_identity_count field
  // TODO: N83 — team_detection_bypass role cluster (Section 21 #83). Requires: v2.1 team_detection_bypass field
  // TODO: N84 — traveller_complexity count (Section 21 #84). Requires: v2.1 traveller complexity scoring
  // TODO: N85 — overall complexity score (Section 21 #85). Requires: v2.1 overall complexity scoring
  for (const fi of ruleN86(roster, scriptContext, charById)) addFinding(errors, warnings, notices, fi, atheist_mode);
  if (f = ruleN87(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleN88(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  if (f = ruleN106(roster, scriptContext, charById)) addFinding(errors, warnings, notices, f, atheist_mode);
  const jinxPairFindings = ruleJinxPairs(roster, charById);
  for (const fi of jinxPairFindings) addFinding(errors, warnings, notices, fi, atheist_mode);
  const djinn_required = jinxPairFindings.length > 0;
  for (const fi of ruleOpenQuestions(roster, charById, scriptContext)) addFinding(errors, warnings, notices, fi, atheist_mode);
  // TODO: N89 — Vortox on Atheist paradox (Section 21 #89). Requires: hasAtheist && 'vortox' in roster check
  // TODO: N90 — Leviathan day-5 cap and 2-good-executions cap (Section 21 #90). Requires: Leviathan ID check
  // TODO: N91 — Riot day-3-force-nominate chain (Section 21 #91). Requires: Riot ID check
  // TODO: N92 — Fang Gu jump-mechanic on Outsider-rich scripts (Section 21 #92). Requires: Fang Gu ID + outsiderCount
  // TODO: N93 — Demon-as-droison-source cluster (Section 21 #93). Requires: v2.1 is_poison_source field on Demons
  // TODO: N94 — Kazali setup-construction implications (Section 21 #94). Requires: Kazali ID check
  // TODO: N95 — Legion inverted_player_count regime (Section 21 #95). Requires: Legion ID check
  // TODO: N96 — posthumous_revival_mechanic cluster (Section 21 #96). Requires: v2.1 posthumous_revival_mechanic field
  // TODO: N97 — Yaggababble day-phase-kill-via-speech (Section 21 #97). Requires: Yaggababble ID check
  // TODO: N98 — Lord of Typhon seating_constraint (Section 21 #98). Requires: Lord of Typhon ID check
  // TODO: N99 — public_identity_at_setup pair on script (Section 21 #99). Requires: Vizier + Leviathan ID check
  // TODO: N100 — Lleech host_dependency_immunity (Section 21 #100). Requires: Lleech ID check
  // TODO: N101 — Demon-jinx-burden compound (Section 21 #101). Requires: jinx count per character in v2.1 data
  // TODO: N102 — Vortox-on-Atheist paradox (Section 21 #102). Requires: hasAtheist && 'vortox' in roster
  // TODO: N103 — creates_demon_mechanic cluster extended (Section 21 #103). Requires: v2.1 creates_demon_mechanic field
  // TODO: N104 — setup_adds_minion cluster (Section 21 #104). Requires: Lil' Monsta / Lord of Typhon ID check
  // TODO: N105 — setup_removes_outsider_fixed cluster (Section 21 #105). Requires: Vigormortis ID check + outsiderCount

  // ── Pass 2b: advisory rules (kind: 'advisory', routed to their own stream) ──
  // Advisories never pass through addFinding, so they cannot reach the errors/warnings gate.
  {
    let a;
    if (a = ruleA01(roster, scriptContext, charById)) advisories.push(a);
    advisories.push(...advisoriesCorrectiveFabled(roster, scriptContext, charById));
  }

  return { errors, warnings, notices, advisories, djinn_required };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Set<string>} selectedIds
 * @param {Map<string, object>} charById
 * @param {{ teensyville?: boolean }} [options]
 * @returns {{ errors: Finding[], warnings: Finding[], notices: Finding[], advisories: Finding[], djinn_required: boolean }}
 */
export function analyseScript(selectedIds, charById, options = {}) {
  const roster = Array.from(selectedIds);
  const scriptContext = buildScriptContext(roster, charById);
  return runRules(roster, charById, scriptContext, options);
}
